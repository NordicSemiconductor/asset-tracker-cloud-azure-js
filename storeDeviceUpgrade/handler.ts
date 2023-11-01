import { app } from '@azure/functions'
import handler from './storeDeviceUpgrade.js'

app.http('storeDeviceUpgrade', {
	methods: ['POST'],
	route: 'firmware',
	authLevel: 'anonymous',
	handler,
})
