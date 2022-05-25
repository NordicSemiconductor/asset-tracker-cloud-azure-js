import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { AzureCliCredential } from '@azure/identity'
import { globalIotHubDPSHostname, ioTHubDPSInfo } from '../iot/ioTHubDPSInfo.js'
import { setting } from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

export const infoCommand = ({
	dpsName,
	resourceGroup,
	getIotHubInfo,
	iotDpsClient,
	credentials,
}: {
	dpsName: string
	resourceGroup: string
	getIotHubInfo: ReturnType<typeof ioTHubDPSInfo>
	iotDpsClient: () => Promise<IotDpsClient>
	credentials: () => Promise<{
		credentials: AzureCliCredential
		subscriptionId: string
	}>
}): CommandDefinition => ({
	command: 'info',
	options: [
		{
			flags: '-o, --output <output>',
			description: 'If set, only return the value of this output',
		},
	],
	action: async ({ output }: { output?: string }) => {
		const {
			properties: { idScope },
		} = await (await iotDpsClient()).iotDpsResource.get(dpsName, resourceGroup)

		const info: Record<string, string> = {
			subscription: (await credentials()).subscriptionId,
			resourceGroup,
			iotHubHostname: (await getIotHubInfo()).hostname,
			iotHubDpsHostname: globalIotHubDPSHostname,
			iotHubDpsIdScope: idScope as string,
		}
		if (output !== undefined) {
			if (info[output] === undefined) {
				throw new Error(`${output} is not defined.`)
			}
			process.stdout.write(info[output])
			return
		}
		Object.entries(info).forEach(([k, v]) => {
			setting(k, v)
		})
	},
	help: 'Prints information about your solution',
})
