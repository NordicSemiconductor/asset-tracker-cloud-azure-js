import type { CosmosDBOutput, InvocationContext } from '@azure/functions'
import { randomUUID } from 'node:crypto'
import { batchToDoc } from '../lib/batchToDoc.js'
import { BatchDeviceUpdate, DeviceUpdate } from '../lib/iotMessages.js'
import { log } from '../lib/log.js'

type Context = Omit<InvocationContext, 'triggerMetadata'> & {
	triggerMetadata: {
		systemProperties: {
			'iothub-connection-device-id': string
			'iothub-enqueuedtime': string
			'iothub-message-source': string
		}
		properties?: Record<string, unknown>
	}
}
/**
 * Store Device Twin Update in Cosmos DB so it can be queried later
 */
const storeDeviceUpdateInCosmosDB =
	(cosmosDb: CosmosDBOutput) =>
	async (
		update: DeviceUpdate | BatchDeviceUpdate,
		context: Context,
	): Promise<void> => {
		log(context)({ context, update })
		const baseDoc = {
			deviceId:
				context.triggerMetadata.systemProperties['iothub-connection-device-id'],
			timestamp:
				context.triggerMetadata.systemProperties['iothub-enqueuedtime'],
			source: context.triggerMetadata.systemProperties['iothub-message-source'],
		} as const

		const isBatch = context.triggerMetadata?.properties?.batch !== undefined

		if (
			!isBatch &&
			context.triggerMetadata.systemProperties['iothub-message-source'] ===
				'Telemetry' &&
			Object.keys(context.triggerMetadata?.properties ?? {}).length > 0
		) {
			log(context)(
				`Ignoring telemetry message with property bag ${JSON.stringify(
					context.triggerMetadata?.properties,
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
