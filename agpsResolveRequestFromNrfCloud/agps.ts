import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { Static, Type } from '@sinclair/typebox'
import { agpsRequestSchema, AGPSType } from '../agps/types.js'
import { ErrorInfo, ErrorType } from '../lib/ErrorInfo.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

const apiRequestSchema = Type.Object(
	{
		eci: PositiveInteger,
		tac: PositiveInteger,
		requestType: Type.RegEx(/^custom$/),
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
		customTypes: Type.Array(Type.Enum(AGPSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(agpsRequestSchema)

export const resolveAgpsRequest =
	(
		client: ReturnType<typeof apiClient>,
		debug?: (...args: any[]) => void,
		error?: (...args: any[]) => void,
	) =>
	async (
		agps: Static<typeof agpsRequestSchema>,
	): Promise<{ error: ErrorInfo } | readonly string[]> => {
		debug?.({ agpsRequest: agps })
		const valid = validateInput(agps)
		if ('error' in valid) {
			error?.(JSON.stringify(valid.error))
			return valid
		}

		const { mcc, mnc, cell, area, types } = valid

		// Split requests, so that request for Ephemerides is a separate one
		const otherTypesInRequest = types.filter((t) => t !== AGPSType.Ephemerides)
		const requestTypes = []
		if (types.includes(AGPSType.Ephemerides))
			requestTypes.push([AGPSType.Ephemerides])
		if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

		const res = []

		for (const types of requestTypes) {
			const request = {
				resource: 'location/agps',
				payload: {
					eci: cell,
					tac: area,
					requestType: 'custom',
					mcc,
					mnc,
					customTypes: types,
				},
				headers: {
					'Content-Type': 'application/octet-stream',
				},
			}
			const maybeHeaders = await client.head({
				...request,
				method: 'GET',
				requestSchema: apiRequestSchema,
			})

			if ('error' in maybeHeaders) {
				return { error: maybeHeaders.error }
			}

			const maybeAgpsData = await client.getBinary({
				...request,
				headers: {
					...request.headers,
					Range: `bytes=0-${maybeHeaders.headers['content-length']}`,
				},
				requestSchema: apiRequestSchema,
			})

			if ('error' in maybeAgpsData) {
				return { error: maybeAgpsData.error }
			}

			const maybeValidAgpsData = verify(maybeAgpsData)

			if ('error' in maybeValidAgpsData) {
				return {
					error: {
						type: ErrorType.BadGateway,
						message: `Could not verify A-GNSS payload: ${maybeValidAgpsData.error.message}!`,
					},
				}
			}

			debug?.({ agpsData: maybeValidAgpsData })
			res.push(maybeAgpsData.toString('hex'))
		}

		return res
	}
