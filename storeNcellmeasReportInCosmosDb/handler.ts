import { app, output } from '@azure/functions'
import handler from './storeNcellmeasReportInCosmosDb.js'

const report = output.cosmosDB({
	databaseName: '%NCELLMEAS_REPORTS_DATABASE_NAME%',
	connection: 'COSMOSDB_CONNECTION_STRING',
	containerName: '%NCELLMEAS_REPORTS_CONTAINER_NAME%',
	createIfNotExists: true,
})

app.eventHub('storeNcellmeasReportInCosmosDb', {
	eventHubName: '%IOTHUB_EVENTS_EVENT_HUB_NAME%',
	cardinality: 'one',
	connection: 'IOTHUB_EVENTS_CONNECTION_STRING',
	consumerGroup: '%NCELLMEAS_REPORTS_IOT_EVENTS_CONSUMER_GROUP_NAME%',
	extraOutputs: [report],
	handler: handler(report),
})
