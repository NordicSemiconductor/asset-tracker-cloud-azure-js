import type { FunctionOutput, InvocationContext } from '@azure/functions'
import { DeviceUpdate, TwinChangeEvent } from '../lib/iotMessages.js'
import { log } from '../lib/log.js'

type Context = Omit<InvocationContext, 'triggerMetadata'> & {
	triggerMetadata: {
		systemPropertiesArray: {
			'iothub-message-source': string
			'iothub-connection-device-id': string
		}[]
		propertiesArray: unknown[]
	}
}

/**
 * Publishes Device Twin Update to SignalR so the web application can receive real-time notifications
 */
const publishDeviceUpdatesToSignalR =
	(signalROutput: FunctionOutput) =>
	async (updates: DeviceUpdate[], context: Context): Promise<void> => {
		log(context)({
			messages: updates,
			systemPropertiesArray: context.triggerMetadata.systemPropertiesArray,
			propertiesArray: context.triggerMetadata.propertiesArray,
		})

		const signalRMessages: Record<string, unknown>[] = []

		const addProperties = (message: DeviceUpdate, k: number) => ({
			message,
			systemProperties: context.triggerMetadata.systemPropertiesArray?.[k],
			propertiesArray: context.triggerMetadata.propertiesArray?.[k],
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
