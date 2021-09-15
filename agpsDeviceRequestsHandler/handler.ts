import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
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
	})({
		...process.env,
	})

/**
 * Queue A-GPS requests from devices
 *
 * See ../adr/007-one-event-hub-for-everything.md for why we have to do filtering of messages here.
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
		const { storageAccountName, storageAccessKey, iotHubConnectionString } =
			config()
		iotHubRegistry = iothub.Registry.fromConnectionString(
			iotHubConnectionString,
		)
		queueClient = new QueueServiceClient(
			`https://${storageAccountName}.queue.core.windows.net`,
			new StorageSharedKeyCredential(storageAccountName, storageAccessKey),
		).getQueueClient('agpsrequests')
		await queueClient.create()
	} catch (error) {
		log(context)({ error: (error as Error).message })
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
		.filter(({ properties }) => properties.agps === 'get')

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
