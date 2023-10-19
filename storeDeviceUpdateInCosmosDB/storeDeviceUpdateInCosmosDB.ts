import { AzureFunction, Context } from '@azure/functions'
import { randomUUID } from 'node:crypto'
import { batchToDoc } from '../lib/batchToDoc.js'
import { BatchDeviceUpdate, DeviceUpdate } from '../lib/iotMessages.js'
import { log } from '../lib/log.js'

/**
 * Store Device Twin Update in Cosmos DB so it can be queried later
 */
const storeDeviceUpdateInCosmosDB: AzureFunction = async (
	context: Context,
	update: DeviceUpdate | BatchDeviceUpdate,
): Promise<void> => {
	log(context)({ context, update })
	const baseDoc = {
		deviceId:
			context.bindingData.systemProperties['iothub-connection-device-id'],
		timestamp: context.bindingData.systemProperties['iothub-enqueuedtime'],
		source: context.bindingData.systemProperties['iothub-message-source'],
	} as const

	const isBatch = context?.bindingData?.properties?.batch !== undefined

	if (
		!isBatch &&
		context.bindingData.systemProperties['iothub-message-source'] ===
			'Telemetry' &&
		Object.keys(context.bindingData?.properties ?? {}).length > 0
	) {
		log(context)(
			`Ignoring telemetry message with property bag ${JSON.stringify(
				context.bindingData.properties,
			)}`,
		)
		return
	}

	type Document = typeof baseDoc & { deviceUpdate: DeviceUpdate } & {
		id: string
	}
	let document: Document | Document[]

	if (isBatch) {
		document = batchToDoc(update as BatchDeviceUpdate).map((deviceUpdate) => ({
			id: randomUUID(),
			...baseDoc,
			deviceUpdate,
		}))
	} else {
		document = {
			id: randomUUID(),
			...baseDoc,
			deviceUpdate: update as DeviceUpdate,
		}
	}

	context.bindings.deviceUpdate = JSON.stringify(document)
	log(context)({ document })
}

export default storeDeviceUpdateInCosmosDB
