import { CommandDefinition } from './CommandDefinition'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { provisionDevice } from '../iot/provisionDevice'

export const provisionSimulatorDevice = ({
	certsDir: certsDirPromise,
	resourceGroup,
	iotDpsClient,
	dpsName,
}: {
	certsDir: () => Promise<string>
	iotDpsClient: () => Promise<IotDpsClient>
	resourceGroup: string
	dpsName: string
}): CommandDefinition => ({
	command: 'provision-simulator-device <deviceId>',
	action: async (deviceId) => {
		const endpoint = await provisionDevice({
			certsDir: await certsDirPromise(),
			deviceId,
			idScope: (
				await (await iotDpsClient()).iotDpsResource.get(dpsName, resourceGroup)
			).properties.idScope as string,
		})
		process.stdout.write(endpoint.assignedHub)
	},
	help: 'Provision a simulator device',
})
