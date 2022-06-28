import { Static, Type } from '@sinclair/typebox'
import { Either, isLeft, right } from 'fp-ts/lib/Either.js'
import { ErrorInfo } from '../lib/ErrorInfo.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import {
	defaultInterval,
	defaultNumberOfPredictions,
	defaultTimeOfDay,
} from '../pgps/cacheKey.js'
import { gpsDay, minimumGpsDay } from '../pgps/gpsTime.js'
import { pgpsRequestSchema } from '../pgps/types.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'

enum Interval {
	twoHours = 120,
	fourHours = 240,
	sixHours = 360,
	eightHours = 480,
}
const apiRequestSchema = Type.Object(
	{
		predictionCount: Type.Optional(
			Type.Integer({
				minimum: 1,
				maximum: 168,
				title: 'number of predictions',
			}),
		),
		predictionIntervalMinutes: Type.Optional(
			Type.Enum(Interval, { title: 'prediction interval in minutes' }),
		),
		startGpsDay: Type.Optional(
			Type.Integer({
				minimum: minimumGpsDay(),
				maximum: gpsDay() + 14, // Current GPS day + 2 weeks is the upper bound for nRF Cloud
				title: 'start day of the prediction set as GPS Day',
			}),
		),
		startGpsTimeOfDaySeconds: Type.Optional(
			Type.Integer({
				minimum: 0,
				maximum: 86399,
				title: 'start time of the prediction set as seconds in day',
			}),
		),
	},
	{ additionalProperties: false },
)

const apiResponseSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		host: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(pgpsRequestSchema)

export const resolvePgpsRequest =
	(
		client: ReturnType<typeof apiClient>,
		debug?: (...args: any[]) => void,
		error?: (...args: any[]) => void,
	) =>
	async (
		pgps: Static<typeof pgpsRequestSchema>,
	): Promise<Either<ErrorInfo, URL>> => {
		debug?.({ pgpsRequest: pgps })
		const valid = validateInput(pgps)
		if (isLeft(valid)) {
			error?.(JSON.stringify(valid.left))
			return valid
		}

		const { n, int, day, time } = valid.right

		const result = await client.get({
			resource: 'location/pgps',
			payload: {
				predictionCount: n ?? defaultNumberOfPredictions,
				predictionIntervalMinutes: int ?? defaultInterval,
				startGpsDay: day ?? gpsDay(),
				startGpsTimeOfDaySeconds: time ?? defaultTimeOfDay,
			},
			requestSchema: apiRequestSchema,
			responseSchema: apiResponseSchema,
		})()

		if (isLeft(result)) {
			error?.(JSON.stringify(result.left))
			return result
		}

		return right(new URL(`https://${result.right.host}/${result.right.path}`))
	}
