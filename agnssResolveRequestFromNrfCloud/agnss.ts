import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { Static, Type } from '@sinclair/typebox'
import { agnssRequestSchema, AGNSSType } from '../agnss/types.js'
import { ErrorInfo, ErrorType } from '../lib/ErrorInfo.js'
import { validate } from '../lib/validate.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

const apiRequestSchema = Type.Object(
	{
		eci: PositiveInteger,
		tac: PositiveInteger,
		requestType: Type.RegExp(/^custom$/),
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
		customTypes: Type.Array(Type.Enum(AGNSSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validate(agnssRequestSchema)

export const resolveAgnssRequest =
	(
		client: ReturnType<typeof apiClient>,
		debug?: (...args: any[]) => void,
		error?: (...args: any[]) => void,
	) =>
	async (
		agnss: Static<typeof agnssRequestSchema>,
	): Promise<{ error: ErrorInfo } | readonly string[]> => {
		debug?.({ agnssRequest: agnss })
		const valid = validateInput(agnss)
		if ('error' in valid) {
			error?.(JSON.stringify(valid.error))
			return valid
		}

		const { mcc, mnc, cell, area, types } = valid.value

		// Split requests, so that request for Ephemerides is a separate one
		const otherTypesInRequest = types.filter((t) => t !== AGNSSType.Ephemerides)
		const requestTypes = []
		if (types.includes(AGNSSType.Ephemerides))
			requestTypes.push([AGNSSType.Ephemerides])
		if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

		const res = []

		for (const types of requestTypes) {
			const request = {
				resource: 'location/agnss',
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

			const maybeAgnssData = await client.getBinary({
				...request,
				headers: {
					...request.headers,
					Range: `bytes=0-${maybeHeaders.headers['content-length']}`,
				},
				requestSchema: apiRequestSchema,
			})

			if ('error' in maybeAgnssData) {
				return { error: maybeAgnssData.error }
			}

			const maybeValidAgnssData = verify(maybeAgnssData)

			if ('error' in maybeValidAgnssData) {
				return {
					error: {
						type: ErrorType.BadGateway,
						message: `Could not verify A-GNSS payload: ${maybeValidAgnssData.error.message}!`,
					},
				}
			}

			debug?.({ agnssData: maybeValidAgnssData })
			res.push(maybeAgnssData.toString('hex'))
		}

		return res
	}
