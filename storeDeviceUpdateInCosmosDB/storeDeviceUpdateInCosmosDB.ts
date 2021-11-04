import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { DeviceUpdate, BatchDeviceUpdate } from '../lib/iotMessages.js'
import { batchToDoc } from '../lib/batchToDoc.js'

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

	if (
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

	type Document = typeof baseDoc & { deviceUpdate: DeviceUpdate }
	let document: Document | Document[]

	if (context?.bindingData?.properties?.batch !== undefined) {
		document = batchToDoc(update as BatchDeviceUpdate).map((deviceUpdate) => ({
			...baseDoc,
			deviceUpdate,
		}))
	} else {
		document = {
			...baseDoc,
			deviceUpdate: update as DeviceUpdate,
		}
	}

	context.bindings.deviceUpdate = JSON.stringify(document)
	log(context)({ document })
}

export default storeDeviceUpdateInCosmosDB
