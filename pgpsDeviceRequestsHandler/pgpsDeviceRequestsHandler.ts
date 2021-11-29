import { AzureFunction, Context } from '@azure/functions'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { pgpsRequestSchema } from '../pgps/types.js'
import { isRight } from 'fp-ts/lib/Either.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'
import {
	QueueServiceClient,
	QueueClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'

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
const pgpsDeviceRequestsHandler: AzureFunction = async (
	context: Context,
	requests:
		| (
				| {
						n: number
						int: number
						day: number
						time: number
				  }
				| Record<string, any>
		  )[],
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
				context.bindingData.systemPropertiesArray[i][
					'iothub-connection-device-id'
				],
			properties: context.bindingData.propertiesArray[i] as Record<
				string,
				string
			>,
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
		if (isRight(valid)) {
			deviceRequests.push({
				request: valid.right,
				deviceId,
			})
		} else {
			logError(context)(JSON.stringify(valid.left))
		}
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
