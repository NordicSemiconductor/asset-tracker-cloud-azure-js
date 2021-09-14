import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { AGPSRequest } from '../lib/iotMessages.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { agpsRequestSchema } from '../agps/types.js'
import { isRight } from 'fp-ts/lib/Either.js'
import { cacheKey } from '../agps/cacheKey.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'

const validateAgpsRequest = validateWithJSONSchema(agpsRequestSchema)

const { binHoursString } = fromEnv({
	binHoursString: 'BIN_HOURS',
})({
	...process.env,
	BIN_HOURS: '1',
})

const binHours = parseInt(binHoursString, 10)

// Keep a local cache in case many devices requests the same location
export type AGPSDataCache = Static<typeof agpsRequestSchema> & {
	source: string
	dataHex?: string[]
	unresolved?: boolean
	updatedAt: Date
}
const resolvedRequests: Record<string, AGPSDataCache> = {}

/**
 * Resolve A-GPS requests for devices
 */
const agpsDeviceRequestHandler: AzureFunction = async (
	context: Context,
	requests: AGPSRequest[],
): Promise<void> => {
	log(context)({ context, requests })
	const deviceRequests: {
		request: Static<typeof agpsRequestSchema>
		deviceId: string
	}[] = []

	// FIXME: fetch device's reported nw property
	// Maybe? https://www.youtube.com/watch?v=S7Q_h1yjGUE&t=251s

	requests.forEach((request, i) => {
		const properties = context.bindingData.propertiesArray[i]
		console.log({ properties })
		if (properties.agps !== 'get') return
		const systemProperties = context.bindingData.systemPropertiesArray[i]
		const valid = validateAgpsRequest(request)
		if (isRight(valid)) {
			deviceRequests.push({
				request: valid.right,
				deviceId: systemProperties['iothub-connection-device-id'],
			})
		} else {
			console.error(valid.left)
		}
	})
	log(context)({ deviceRequests })

	// Group requests by cacheKey
	const byCacheKey = deviceRequests.reduce(
		(grouped, deviceRequest) => {
			const k = cacheKey({ request: deviceRequest.request, binHours })
			if (grouped[k] === undefined) {
				grouped[k] = [deviceRequest]
			} else {
				grouped[k].push(deviceRequest)
			}
			return grouped
		},
		{} as Record<
			string,
			{
				request: Static<typeof agpsRequestSchema>
				deviceId: string
			}[]
		>,
	)
	log(context)({ byCacheKey })

	// Resolve data
	await Promise.all(
		Object.entries(byCacheKey).map(
			async ([cacheKey, deviceRequests]): Promise<void> => {
				if (resolvedRequests[cacheKey] === undefined) {
					log(context)(cacheKey, 'Load from DB', deviceRequests[0].request)
				}
			},
		),
	)
}

export default agpsDeviceRequestHandler
