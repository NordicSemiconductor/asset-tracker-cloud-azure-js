import { AzureFunction, Context } from '@azure/functions'
import {
	QueueClient,
	QueueServiceClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'
import { Static } from '@sinclair/typebox'
import { isRight } from 'fp-ts/lib/Either.js'
import { agpsRequestSchema } from '../agps/types.js'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'

const validateAgpsRequest = validateWithJSONSchema(agpsRequestSchema)

const config = () =>
	fromEnv({
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		agpsRequestsQueueName: 'AGPS_REQUESTS_QUEUE_NAME',
	})({
		...process.env,
	})

/**
 * Queue A-GPS requests from devices
 *
 * This handler filters for A-GPS requests.
 * See ../adr/007-one-event-hub-for-everything.md for why we have to do filtering of messages here.
 *
 * The requests are put in a queue for resolving.
 */
const agpsDeviceRequestsHandler: AzureFunction = async (
	context: Context,
	requests:
		| (
				| {
						mcc: number
						mnc: number
						cell: number
						area: number
						types: number[]
				  }
				| Record<string, any>
		  )[],
): Promise<void> => {
	log(context)({ context, requests })

	const timestamp = new Date()
	let queueClient: QueueClient

	try {
		const { storageAccountName, storageAccessKey, agpsRequestsQueueName } =
			config()

		queueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(agpsRequestsQueueName)
		await queueClient.create()
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

	// Find A-GPS requests
	const agpsRequests = requests
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
		.filter(({ properties }) => properties.agps === 'get')

	if (agpsRequests.length === 0) {
		log(context)(`No A-GPS requests found.`)
		return
	}

	log(context)({ agpsRequests })

	// Build list of valid requests
	const deviceRequests: {
		request: Static<typeof agpsRequestSchema>
		deviceId: string
	}[] = []
	agpsRequests.forEach(({ request, deviceId }) => {
		const valid = validateAgpsRequest(request)
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

export default agpsDeviceRequestsHandler
