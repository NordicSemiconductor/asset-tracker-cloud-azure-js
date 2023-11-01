import { app } from '@azure/functions'
import handler from './agnssResolveRequestFromNrfCloud.js'

app.storageQueue('agnssResolveRequestFromNrfCloud', {
	queueName: '%AGNSS_REQUESTS_NRFCLOUD_QUEUE_NAME%',
	connection: '',
	handler,
})
