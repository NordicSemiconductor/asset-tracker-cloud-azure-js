import { EventHubHandler, app, output } from '@azure/functions'
import handler from './publishDeviceUpdatesToSignalR.js'

const signalROutput = output.generic({
	type: 'signalR',
	hubName: 'deviceUpdates',
	connectionStringSetting: 'SignalRConnectionString',
})

app.eventHub('publishDeviceUpdatesToSignalR', {
	cardinality: 'many',
	eventHubName: '%IOTHUB_EVENTS_EVENT_HUB_NAME%',
	connection: 'IOTHUB_EVENTS_CONNECTION_STRING',
	consumerGroup: 'publishdeviceupdates',
	extraOutputs: [signalROutput],
	handler: handler(signalROutput) as EventHubHandler,
})
