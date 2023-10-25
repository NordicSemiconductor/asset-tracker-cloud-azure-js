import type { CosmosDBOutput, EventHubHandler } from '@azure/functions'
import { randomUUID } from 'node:crypto'
import { batchToDoc } from '../lib/batchToDoc.js'
import { BatchDeviceUpdate, DeviceUpdate } from '../lib/iotMessages.js'
import { log } from '../lib/log.js'

/**
 * Store Device Twin Update in Cosmos DB so it can be queried later
 */
const storeDeviceUpdateInCosmosDB =
	(cosmosDb: CosmosDBOutput): EventHubHandler =>
	async (message, context) => {
		const update = message as DeviceUpdate | BatchDeviceUpdate

		log(context)({ context, update })
		const systemProperties = context.triggerMetadata
			?.systemProperties as Record<string, unknown>
		const baseDoc = {
			deviceId: systemProperties['iothub-connection-device-id'],
			timestamp: systemProperties['iothub-enqueuedtime'],
			source: systemProperties['iothub-message-source'],
		} as const

		const properties = context.triggerMetadata?.properties as Record<
			string,
			unknown
		>
		const isBatch = properties?.batch !== undefined

		if (
			!isBatch &&
			systemProperties['iothub-message-source'] === 'Telemetry' &&
			Object.keys(properties ?? {}).length > 0
		) {
			log(context)(
				`Ignoring telemetry message with property bag ${JSON.stringify(
					properties,
				)}`,
			)
			return
		}

		type Document = typeof baseDoc & { deviceUpdate: DeviceUpdate } & {
			id: string
		}
		let document: Document | Document[]

		if (isBatch) {
			document = batchToDoc(update as BatchDeviceUpdate).map(
				(deviceUpdate) => ({
					id: randomUUID(),
					...baseDoc,
					deviceUpdate,
				}),
			)
		} else {
			document = {
				id: randomUUID(),
				...baseDoc,
				deviceUpdate: update as DeviceUpdate,
			}
		}

		context.extraOutputs.set(cosmosDb, document)
		log(context)({ document })
	}

export default storeDeviceUpdateInCosmosDB
