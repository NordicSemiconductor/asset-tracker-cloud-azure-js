import { app } from '@azure/functions'
import handler from './mock-http-api.js'

app.http('mock-http-api', {
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
	route: '{*restOfPath}',
	authLevel: 'anonymous',
	handler,
})
