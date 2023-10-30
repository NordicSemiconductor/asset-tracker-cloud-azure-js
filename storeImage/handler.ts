import { app } from '@azure/functions'
import handler from './storeImage.js'

app.http('storeImage', {
	methods: ['POST'],
	route: 'images',
	authLevel: 'anonymous',
	handler,
})
