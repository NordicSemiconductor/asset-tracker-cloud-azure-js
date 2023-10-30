import { app, output } from '@azure/functions'
import handler from './storeDeviceUpdateInCosmosDB.js'

const deviceUpdate = output.cosmosDB({
	databaseName: 'deviceMessages',
	connection: 'COSMOSDB_CONNECTION_STRING',
	containerName: 'updates',
	partitionKey: '/deviceId',
	createIfNotExists: true,
})

app.eventHub('storeDeviceUpdateInCosmosDB', {
	eventHubName: '%IOTHUB_EVENTS_EVENT_HUB_NAME%',
	cardinality: 'one',
	connection: 'IOTHUB_EVENTS_CONNECTION_STRING',
	consumerGroup: 'storedeviceupdate',
	extraOutputs: [deviceUpdate],
	handler: handler(deviceUpdate),
})
