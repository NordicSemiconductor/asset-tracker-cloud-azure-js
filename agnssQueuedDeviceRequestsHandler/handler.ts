import { app } from '@azure/functions'
import handler from './agnssQueuedDeviceRequestsHandler.js'

app.storageQueue('agnssQueuedDeviceRequestsHandler', {
	queueName: '%AGNSS_REQUESTS_QUEUE_NAME%',
	connection: '',
	handler,
})
