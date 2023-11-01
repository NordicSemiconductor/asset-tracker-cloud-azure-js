import { app } from '@azure/functions'
import handler from './getDevice.js'

app.http('getDevice', {
	methods: ['GET'],
	route: 'device/{id}',
	authLevel: 'anonymous',
	handler,
})
