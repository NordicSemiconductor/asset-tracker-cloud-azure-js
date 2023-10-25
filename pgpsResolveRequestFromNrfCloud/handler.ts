import { app } from '@azure/functions'
import handler from './pgpsResolveRequestFromNrfCloud.js'

app.storageQueue('pgpsResolveRequestFromNrfCloud', {
	queueName: '%PGPS_REQUESTS_NRFCLOUD_QUEUE_NAME%',
	connection: '',
	handler,
})
