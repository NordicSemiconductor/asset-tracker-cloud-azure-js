import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { agpsRequestSchema } from '../agps/types.js'
import { cacheKey } from '../agps/cacheKey.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'
import iothub from 'azure-iothub'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { Container, CosmosClient } from '@azure/cosmos'
import iothubCommon from 'azure-iot-common'
import {
	QueueServiceClient,
	QueueClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'

const config = () =>
	fromEnv({
		binHoursString: 'BIN_HOURS',
		iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		maxResolutionTimeInMinutes: 'AGPS_MAX_RESOLUTION_TIME_IN_MINUTES',
		initialDelayString: 'INITIAL_DELAY',
		delayFactorString: 'DELAY_FACTOR',
		agpsRequestsDatabaseName: 'AGPS_REQUESTS_DATABASE_NAME',
		agpsRequestsContainerName: 'AGPS_REQUESTS_CONTAINER_NAME',
		agpsRequestsQueueName: 'AGPS_REQUESTS_QUEUE_NAME',
		agpsRequestsNrfCloudQueueName: 'AGPS_REQUESTS_NRFCLOUD_QUEUE_NAME',
	})({
		BIN_HOURS: '1',
		AGPS_MAX_RESOLUTION_TIME_IN_MINUTES: '15',
		INITIAL_DELAY: '5',
		DELAY_FACTOR: '1.5',
		...process.env,
	})

// Keep a local cache in case many devices requests the same location
export type AGPSDataCache = Static<typeof agpsRequestSchema> & {
	source: string
	dataHex?: string[]
	unresolved?: boolean
	updatedAt: Date
}
const resolvedRequests: Record<string, AGPSDataCache> = {}

type QueuedAGPSRequest = {
	deviceId: string
	request: Static<typeof agpsRequestSchema>
	timestamp: string
	delayInSeconds?: number
}

/**
 * Resolve A-GPS requests for devices by either fetching the cached data from
 * a DB or kicking off the resoluting via a third-party API (currently only
 * nRF Cloud Assisted GPS Location Service is implemented.)
 */
const agpsQueuedDeviceRequestsHandler: AzureFunction = async (
	context: Context,
	{ deviceId, request, delayInSeconds, timestamp }: QueuedAGPSRequest,
): Promise<void> => {
	log(context)({ request, deviceId, delayInSeconds, timestamp, context })

	let binHours: number
	let iotHubClient: iothub.Client
	let cosmosDbContainer: Container
	let agpsRequestsQueueClient: QueueClient
	const resolverQueues: QueueClient[] = []
	let maxResolutionTimeInSeconds: number
	let delayFactor: number
	let initialDelay: number

	try {
		const {
			binHoursString,
			iotHubConnectionString,
			storageAccountName,
			storageAccessKey,
			maxResolutionTimeInMinutes,
			delayFactorString,
			initialDelayString,
			cosmosDbConnectionString,
			agpsRequestsDatabaseName,
			agpsRequestsQueueName,
			agpsRequestsContainerName,
			agpsRequestsNrfCloudQueueName,
		} = config()

		binHours = parseInt(binHoursString, 10)
		iotHubClient = iothub.Client.fromConnectionString(iotHubConnectionString)

		const { AccountEndpoint, AccountKey } = parseConnectionString(
			cosmosDbConnectionString,
		)
		const cosmosClient = new CosmosClient({
			endpoint: AccountEndpoint,
			key: AccountKey,
		})

		cosmosDbContainer = cosmosClient
			.database(agpsRequestsDatabaseName)
			.container(agpsRequestsContainerName)

		agpsRequestsQueueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(agpsRequestsQueueName)
		await agpsRequestsQueueClient.create()

		const nrfCloudAgpsRequestsQueueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(agpsRequestsNrfCloudQueueName)
		await nrfCloudAgpsRequestsQueueClient.create()
		resolverQueues.push(nrfCloudAgpsRequestsQueueClient)

		maxResolutionTimeInSeconds = parseInt(maxResolutionTimeInMinutes, 10) * 60
		delayFactor = parseFloat(delayFactorString)
		initialDelay = parseInt(initialDelayString, 10)
	} catch (error) {
		log(context)({ error: (error as Error).message })
		return
	}

	// Resolve data
	const requestCacheKey = cacheKey({ request, binHours })
	if (resolvedRequests[requestCacheKey] === undefined) {
		log(context)(requestCacheKey, 'Load from DB', request)
		const { resources } = await cosmosDbContainer.items
			.query(`SELECT * FROM c WHERE c.cacheKey='${requestCacheKey}'`)
			.fetchNext()
		log(context)({ resources })
		if (resources.length) {
			if (resources[0].unresolved !== undefined) {
				context.log.verbose(
					requestCacheKey,
					'Processing of the request is finished',
				)
				// Cache resolved
				resolvedRequests[requestCacheKey] = resources[0]
				if (resources[0].unresolved === true) {
					context.log.error(requestCacheKey, `A-GPS request is unresolved.`)
					return
				}
			}
		} else {
			context.log.verbose(requestCacheKey, 'cache does not exist')
			await Promise.all([
				// Put in DB
				cosmosDbContainer.items.create({
					cacheKey: requestCacheKey,
					...request,
					updatedAt: new Date().toISOString(),
				}),
				// Kick off resolution
				resolverQueues.map(async (client) =>
					client.sendMessage(
						Buffer.from(JSON.stringify(request), 'utf-8').toString('base64'),
						{
							messageTimeToLive: maxResolutionTimeInSeconds,
						},
					),
				),
			])
		}
	}

	// The data for the request is available
	if (
		resolvedRequests[requestCacheKey]?.unresolved !== undefined &&
		resolvedRequests[requestCacheKey].unresolved === false
	) {
		context.log.verbose(requestCacheKey, 'data for the request is available')
		context.log.verbose(
			JSON.stringify({
				request,
				resolvedRequests,
			}),
		)
		await Promise.all(
			(resolvedRequests[requestCacheKey]?.dataHex ?? []).map(
				async (agpsdata) => {
					context.log(`Sending ${agpsdata.length} bytes to ${deviceId}`)
					const m = new iothubCommon.Message(Buffer.from(agpsdata, 'hex'))
					m.properties.add('agps', 'result')
					return iotHubClient.send(deviceId, m)
				},
			),
		)

		context.log.verbose(requestCacheKey, `resolved request for`, deviceId)
		return
	}

	// Resolution is in progress ... put request in queue again, with increasing delay
	// Eventually, messages will be discarded from the queue
	const requestStarted = new Date(timestamp)
	const ageInSeconds = Math.floor(
		(Date.now() - requestStarted.getTime()) / 1000,
	)

	// Request resolution timed out
	if (ageInSeconds > maxResolutionTimeInSeconds) {
		context.log.error(
			`Cancelling request because of resolution timeout after ${ageInSeconds} seconds.`,
		)
		context.log.error(
			JSON.stringify(
				{
					cancelled: request,
					maxResolutionTimeInSeconds,
				},
				null,
				2,
			),
		)
		return
	}

	// Put reques in queue, with increased delay
	const visibilityTimeout = Math.floor(
		Math.min(900, (delayInSeconds ?? initialDelay) * delayFactor),
	)
	await agpsRequestsQueueClient.sendMessage(
		Buffer.from(
			JSON.stringify({
				deviceId,
				request,
				delayInSeconds: visibilityTimeout,
				timestamp,
			}),
			'utf-8',
		).toString('base64'),
		{
			messageTimeToLive: maxResolutionTimeInSeconds,
			visibilityTimeout,
		},
	)
	context.log.verbose(requestCacheKey, `re-scheduled request for`, deviceId)
}

export default agpsQueuedDeviceRequestsHandler
