import { app } from '@azure/functions'
import handler from './agnssDeviceRequestsHandler.js'

app.eventHub('agnssDeviceRequestsHandler', {
	eventHubName: '%IOTHUB_EVENTS_EVENT_HUB_NAME%',
	connection: 'IOTHUB_EVENTS_CONNECTION_STRING',
	cardinality: 'many',
	consumerGroup: '%AGNSS_REQUESTS_IOT_EVENTS_CONSUMER_GROUP_NAME%',
	handler,
})
