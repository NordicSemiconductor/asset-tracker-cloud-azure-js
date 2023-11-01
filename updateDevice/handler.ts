import { app } from '@azure/functions'
import handler from './updateDevice.js'

app.http('updateDevice', {
	methods: ['PATCH'],
	route: 'device/{id}',
	authLevel: 'anonymous',
	handler,
})
