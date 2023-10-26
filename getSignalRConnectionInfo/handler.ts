import { app, input } from '@azure/functions'
import handler from './getSignalRConnectionInfo.js'

const connectionInfo = input.generic({
	type: 'signalRConnectionInfo',
	hubName: 'deviceUpdates',
	connectionStringSetting: 'SignalRConnectionString',
})

app.http('getSignalRConnectionInfo', {
	methods: ['GET'],
	route: 'signalRConnectionInfo',
	authLevel: 'anonymous',
	extraInputs: [connectionInfo],
	handler: handler(connectionInfo),
})
