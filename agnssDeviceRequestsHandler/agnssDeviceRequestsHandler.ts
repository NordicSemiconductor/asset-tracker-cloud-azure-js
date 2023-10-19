import { AzureFunction, Context } from '@azure/functions'
import {
	QueueClient,
	QueueServiceClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'
import { Static } from '@sinclair/typebox'
import { agnssRequestSchema } from '../agnss/types.js'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'

const validateAgnssRequest = validateWithJSONSchema(agnssRequestSchema)

const config = () =>
	fromEnv({
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		agnssRequestsQueueName: 'AGNSS_REQUESTS_QUEUE_NAME',
	})({
		...process.env,
	})

/**
 * Queue A-GNSS requests from devices
 *
 * This handler filters for A-GNSS requests.
 * See ../adr/007-one-event-hub-for-everything.md for why we have to do filtering of messages here.
 *
 * The requests are put in a queue for resolving.
 */
const agnssDeviceRequestsHandler: AzureFunction = async (
	context: Context,
	requests: (
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
		const { storageAccountName, storageAccessKey, agnssRequestsQueueName } =
			config()

		queueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(agnssRequestsQueueName)
		await queueClient.create()
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

	// Find A-GNSS requests
	const agnssRequests = requests
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
		.filter(({ properties }) => properties.agnss === 'get')

	if (agnssRequests.length === 0) {
		log(context)(`No A-GNSS requests found.`)
		return
	}

	log(context)({ agnssRequests })

	// Build list of valid requests
	const deviceRequests: {
		request: Static<typeof agnssRequestSchema>
		deviceId: string
	}[] = []
	agnssRequests.forEach(({ request, deviceId }) => {
		const valid = validateAgnssRequest(request)
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

export default agnssDeviceRequestsHandler
