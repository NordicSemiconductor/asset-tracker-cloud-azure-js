import { app, output } from '@azure/functions'
import handler from './geolocateCell.js'

const cellGeolocation = output.cosmosDB({
	databaseName: 'cellGeolocation',
	connection: 'COSMOSDB_CONNECTION_STRING',
	containerName: 'nrfCloudCache',
	createIfNotExists: true,
	partitionKey: '/cellId',
})

app.http('geolocateCell', {
	methods: ['GET'],
	route: 'cellgeolocation/nrfcloud',
	authLevel: 'anonymous',
	extraOutputs: [cellGeolocation],
	handler: handler(cellGeolocation),
})
