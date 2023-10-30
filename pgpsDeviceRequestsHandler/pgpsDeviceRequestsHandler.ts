import type { InvocationContext } from '@azure/functions'
import {
	QueueClient,
	QueueServiceClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { pgpsRequestSchema } from '../pgps/types.js'

type PGPS = (
	| {
			n: number
			int: number
			day: number
			time: number
	  }
	| Record<string, any>
)[]
type PGPSContext = Omit<InvocationContext, 'triggerMetadata'> & {
	triggerMetadata: {
		systemPropertiesArray: {
			'iothub-connection-device-id': string
		}[]
		propertiesArray: Record<string, string>[]
	}
}

const validatePgpsRequest = validateWithJSONSchema(pgpsRequestSchema)

const config = () =>
	fromEnv({
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		pgpsRequestsQueueName: 'PGPS_REQUESTS_QUEUE_NAME',
	})({
		...process.env,
	})

/**
 * Queue P-GPS requests from devices
 *
 * This handler filters for P-GPS requests.
 * See ../adr/007-one-event-hub-for-everything.md for why we have to do filtering of messages here.
 *
 * The requests are put in a queue for resolving.
 */
const pgpsDeviceRequestsHandler = async (
	requests: PGPS,
	context: PGPSContext,
): Promise<void> => {
	log(context)({ context, requests })

	const timestamp = new Date()
	let queueClient: QueueClient

	try {
		const { storageAccountName, storageAccessKey, pgpsRequestsQueueName } =
			config()

		queueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(pgpsRequestsQueueName)
		await queueClient.create()
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

	// Find P-GPS requests
	const pgpsRequests = requests
		.map((request, i) => ({
			request,
			deviceId:
				context.triggerMetadata.systemPropertiesArray?.[i][
					'iothub-connection-device-id'
				],
			properties: context.triggerMetadata.propertiesArray?.[i],
		}))
		.filter(({ properties }) => properties.pgps === 'get')

	if (pgpsRequests.length === 0) {
		log(context)(`No P-GPS requests found.`)
		return
	}

	log(context)({ pgpsRequests })

	// Build list of valid requests
	const deviceRequests: {
		request: Static<typeof pgpsRequestSchema>
		deviceId: string
	}[] = []
	pgpsRequests.forEach(({ request, deviceId }) => {
		const valid = validatePgpsRequest(request)
		if ('error' in valid) {
			logError(context)(JSON.stringify(valid.error))
			return
		}
		deviceRequests.push({
			request: valid,
			deviceId,
		})
	})
	log(context)({ deviceRequests })

	// Queue requests
	await Promise.all(
		deviceRequests.map(async (request) =>
			queueClient.sendMessage(
				Buffer.from(
					JSON.stringify({
						...request,
						timestamp: timestamp.toISOString(),
					}),
					'utf-8',
				).toString('base64'),
				{
					messageTimeToLive: 15 * 60 * 60,
				},
			),
		),
	)
}

export default pgpsDeviceRequestsHandler
