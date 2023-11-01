import { app } from '@azure/functions'
import handler from './geolocateReport.js'

app.http('geolocateReport', {
	methods: ['GET'],
	route: 'neighborcellgeolocation/{reportId}/nrfcloud',
	authLevel: 'anonymous',
	handler,
})
