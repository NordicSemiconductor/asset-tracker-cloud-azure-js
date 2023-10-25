import { app } from '@azure/functions'
import handler from './pgpsQueuedDeviceRequestsHandler.js'

app.storageQueue('pgpsQueuedDeviceRequestsHandler', {
	queueName: '%PGPS_REQUESTS_QUEUE_NAME%',
	connection: '',
	handler,
})
