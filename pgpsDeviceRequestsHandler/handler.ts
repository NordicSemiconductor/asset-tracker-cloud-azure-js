import { app } from '@azure/functions'
import handler from './pgpsDeviceRequestsHandler.js'

app.eventHub('pgpsDeviceRequestsHandler', {
	eventHubName: '%IOTHUB_EVENTS_EVENT_HUB_NAME%',
	connection: 'IOTHUB_EVENTS_CONNECTION_STRING',
	cardinality: 'many',
	consumerGroup: '%PGPS_REQUESTS_IOT_EVENTS_CONSUMER_GROUP_NAME%',
	handler,
})
