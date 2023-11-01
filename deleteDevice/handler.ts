import { app } from '@azure/functions'
import handler from './deleteDevice.js'

app.http('deleteDevice', {
	methods: ['DELETE'],
	route: 'device/{id}',
	authLevel: 'anonymous',
	handler,
})
