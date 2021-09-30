import { AzureFunction, Context } from '@azure/functions'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { agpsRequestSchema } from '../agps/types.js'
import { isRight } from 'fp-ts/lib/Either.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'
import iothub from 'azure-iothub'
import {
	QueueServiceClient,
	QueueClient,
	StorageSharedKeyCredential,
} from '@azure/storage-queue'

const validateAgpsRequest = validateWithJSONSchema(agpsRequestSchema)

const config = () =>
	fromEnv({
		iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		agpsRequestsQueueName: 'AGPS_REQUESTS_QUEUE_NAME',
	})({
		...process.env,
	})

/**
 * Queue A-GPS requests from devices
 *
 * This handler filters for A-GPS requests and enriches them from the device with their reported network mode.
 * See ../adr/007-one-event-hub-for-everything.md for why we have to do filtering of messages here.
 *
 * The enriched requests are put in a queue for resolving.
 */
const agpsDeviceRequestsHandler: AzureFunction = async (
	context: Context,
	requests: {
		mcc: number
		mnc: number
		cell: number
		area: number
		types: number[]
	}[],
): Promise<void> => {
	log(context)({ context, requests })

	const timestamp = new Date()
	let iotHubRegistry: iothub.Registry
	let queueClient: QueueClient

	try {
		const {
			storageAccountName,
			storageAccessKey,
			iotHubConnectionString,
			agpsRequestsQueueName,
		} = config()

		iotHubRegistry = iothub.Registry.fromConnectionString(
			iotHubConnectionString,
		)
		queueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient(agpsRequestsQueueName)
		await queueClient.create()
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

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
		.filter(
			({ properties }) =>
				properties.agps === 'get' ||
				// Note: there is a bug in Azure's IoT Hub event handling which causes messages with
				// property bags on the topic that have a question mark to not be parsed correctly.
				// Despite the '?' being a valid separator of the property bag from the topic name, as
				// per https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support#receiving-cloud-to-device-messages
				// it is not stripped from the query string and included as part of the first property.
				// This has been reported to Microsoft in the support case 2109160040003284.
				properties['?agps'] === 'get',
		)

	if (agpsRequests.length === 0) {
		log(context)(`No A-GPS requests found.`)
		return
	}

	log(context)({ agpsRequests })

	// Fetch reported network for the devices
	const nwReported = (
		(
			await iotHubRegistry
				.createQuery(
					`SELECT deviceId, properties.reported.dev.v.nw FROM devices WHERE deviceId IN [${[
						...new Set(agpsRequests.map(({ deviceId }) => deviceId)), // Ensure deviceIds are unique
					]
						.map((deviceId) => `'${deviceId}'`)
						.join(',')}]`,
				)
				.nextAsTwin()
		).result as unknown as { deviceId: string; nw: string }[]
	).reduce(
		(nwReported, { deviceId, nw }) => ({
			...nwReported,
			[deviceId]: nw,
		}),
		{} as Record<string, string>,
	)

	log(context)({ nwReported })

	// Build list of valid requests
	const deviceRequests: {
		request: Static<typeof agpsRequestSchema>
		deviceId: string
	}[] = []
	agpsRequests.forEach(({ request, deviceId }) => {
		const valid = validateAgpsRequest({
			...request,
			nw: nwReported[deviceId],
		})
		if (isRight(valid)) {
			deviceRequests.push({
				request: valid.right,
				deviceId,
			})
		} else {
			console.error(JSON.stringify(valid.left))
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
