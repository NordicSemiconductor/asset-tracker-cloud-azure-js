import { Static, Type } from '@sinclair/typebox'
import { agpsRequestSchema, AGPSType } from '../agps/types.js'
import { pipe } from 'fp-ts/lib/function.js'
import * as TE from 'fp-ts/lib/TaskEither.js'
import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { ErrorInfo, ErrorType } from '../lib/ErrorInfo.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { isLeft, Either, left, isRight } from 'fp-ts/lib/Either.js'

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
	(client: ReturnType<typeof apiClient>, debug?: (...args: any[]) => void) =>
	async (
		agps: Static<typeof agpsRequestSchema>,
	): Promise<Either<ErrorInfo, readonly string[]>> => {
		debug?.({ agpsRequest: agps })
		const valid = validateInput(agps)
		if (isLeft(valid)) {
			console.error(JSON.stringify(valid.left))
			return valid
		}

		const { mcc, mnc, cell, area, types } = valid.right

		// Split requests, so that request for Ephemerides is a separate one
		const otherTypesInRequest = types.filter((t) => t !== AGPSType.Ephemerides)
		const requestTypes = []
		if (types.includes(AGPSType.Ephemerides))
			requestTypes.push([AGPSType.Ephemerides])
		if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

		const res = await pipe(
			requestTypes,
			TE.traverseArray((types) =>
				pipe(
					TE.right({
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
					}),
					TE.chain((request) =>
						pipe(
							client.head({
								...request,
								method: 'GET',
								requestSchema: apiRequestSchema,
							}),
							TE.chain((headers) =>
								client.getBinary({
									...request,
									headers: {
										...request.headers,
										Range: `bytes=0-${headers['content-length']}`,
									},
									requestSchema: apiRequestSchema,
								}),
							),
							TE.chain((agpsData) =>
								pipe(
									agpsData,
									verify,
									TE.fromEither,
									TE.mapLeft(
										(error) =>
											({
												type: ErrorType.BadGateway,
												message: `Could not verify A-GPS payload: ${error.message}!`,
											} as ErrorInfo),
									),
									TE.map((agpsDataInfo) => {
										debug?.({ agpsData: agpsDataInfo })
										return agpsData.toString('hex')
									}),
								),
							),
						),
					),
				),
			),
		)()

		// If any request fails, mark operation as failed
		if (isRight(res) && res.right.length !== requestTypes.length) {
			return left({
				type: ErrorType.BadGateway,
				message: `Resolved ${res.right.length}, expected ${requestTypes.length}!`,
			} as ErrorInfo)
		}

		return res
	}
