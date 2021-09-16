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

	type Document = typeof baseDoc & { deviceUpdate: DeviceUpdate }
	let document: Document | Document[]

	if (
		context?.bindingData?.properties?.batch !== undefined ||
		// Note: there is a bug in Azure's IoT Hub event handling which causes messages with
		// property bags on the topic that have a question mark to not be parsed correctly.
		// Despite the '?' being a valid separator of the property bag from the topic name, as
		// per https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support#receiving-cloud-to-device-messages
		// it is not stripped from the query string and included as part of the first property.
		// This has been reported to Microsoft in the support case 2109160040003284.
		context?.bindingData?.properties?.['?batch'] !== undefined
	) {
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
