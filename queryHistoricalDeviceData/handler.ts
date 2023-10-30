import { app } from '@azure/functions'
import handler from './queryHistoricalDeviceData.js'

app.http('queryHistoricalDeviceData', {
	methods: ['POST'],
	route: 'history',
	authLevel: 'anonymous',
	handler,
})
