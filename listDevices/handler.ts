import { app } from '@azure/functions'
import handler from './listDevices.js'

app.http('listDevices', {
	methods: ['GET'],
	route: 'devices',
	authLevel: 'anonymous',
	handler,
})
