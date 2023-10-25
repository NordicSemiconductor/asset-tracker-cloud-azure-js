import { app } from '@azure/functions'
import handler from './queryNcellmeasReport.js'

app.http('queryNcellmeasReport', {
	methods: ['POST'],
	route: 'neighborcellgeolocation/reports',
	authLevel: 'anonymous',
	handler,
})
