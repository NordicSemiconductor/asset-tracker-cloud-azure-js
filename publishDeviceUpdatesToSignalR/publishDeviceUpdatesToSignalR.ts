import type { EventHubHandler, FunctionOutput } from '@azure/functions'
import { DeviceUpdate, TwinChangeEvent } from '../lib/iotMessages.js'
import { log } from '../lib/log.js'

/**
 * Publishes Device Twin Update to SignalR so the web application can receive real-time notifications
 */
const publishDeviceUpdatesToSignalR =
	(signalROutput: FunctionOutput): EventHubHandler =>
	async (eventMessages, context) => {
		const updates = eventMessages as DeviceUpdate[]

		const systemPropertiesArray = Array.isArray(
			context.triggerMetadata?.systemPropertiesArray,
		)
			? context.triggerMetadata?.systemPropertiesArray
			: []
		const propertiesArray = Array.isArray(
			context.triggerMetadata?.propertiesArray,
		)
			? context.triggerMetadata?.propertiesArray
			: []

		log(context)({
			messages: updates,
			systemPropertiesArray,
			propertiesArray,
		})

		const signalRMessages: Record<string, unknown>[] = []

		const addProperties = (message: DeviceUpdate, k: number) => ({
			message,
			systemProperties: systemPropertiesArray?.[k],
			propertiesArray: propertiesArray?.[k],
		})

		const reportedUpdates = updates
			.map(addProperties)
			.filter(
				({ systemProperties }) =>
					systemProperties['iothub-message-source'] === 'twinChangeEvents',
			)
			.filter(
				({ message }) =>
					(message as TwinChangeEvent)?.properties?.reported ??
					(message as TwinChangeEvent)?.properties?.desired,
			)
			.map(({ message, systemProperties }) => ({
				deviceId: systemProperties['iothub-connection-device-id'],
				state: {
					reported: (message as TwinChangeEvent)?.properties?.reported,
					desired: (message as TwinChangeEvent)?.properties?.desired,
				},
			}))

		if (reportedUpdates.length) {
			signalRMessages.push(
				...reportedUpdates.map((update) =>
					// Send to a per-device "topic", so clients can subscribe to updates for a specific device
					({
						target: `deviceState:${update.deviceId}`,
						arguments: [update],
					}),
				),
			)
		}

		const messages = updates
			.map(addProperties)
			.filter(
				({ systemProperties }) =>
					systemProperties['iothub-message-source'] === 'Telemetry',
			)
			.map(({ message, systemProperties, propertiesArray }) => ({
				deviceId: systemProperties['iothub-connection-device-id'],
				message,
				propertiesArray,
			}))

		if (messages.length) {
			signalRMessages.push(
				...messages.map((message) =>
					// Send to a per-device "topic", so clients can subscribe to updates for a specific device
					({
						target: `deviceMessage:${message.deviceId}`,
						arguments: [message],
					}),
				),
			)
			messages.forEach((message) => {
				// Send to a per-action "topic", so clients can subscribe to updates for a specific action
				signalRMessages.push(
					...Object.keys(message.message).map((key) => ({
						target: `deviceMessage:${key}`,
						arguments: [message],
					})),
				)
			})
		}

		log(context)({ signalRMessages })

		context.extraOutputs.set(signalROutput, signalRMessages)
	}

export default publishDeviceUpdatesToSignalR
