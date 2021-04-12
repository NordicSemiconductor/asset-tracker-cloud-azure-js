import { CommandDefinition } from './CommandDefinition'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { fromEnv } from '../../lib/fromEnv'
import { WebSiteManagementClient } from '@azure/arm-appservice'

export const reactConfigCommand = ({
	websiteClient,
	resourceGroup,
}: {
	websiteClient: () => Promise<WebSiteManagementClient>
	resourceGroup: string
}): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const [{ hostNames }] = await Promise.all([
			websiteClient().then(async (client) =>
				client.webApps.get(resourceGroup, `${resourceGroup}api`),
			),
		])

		process.stdout.write(
			objectToEnv(
				{
					cloudFlavour: 'Azure',
					...fromEnv({
						azureB2cTenant: 'B2C_TENANT',
						azureClientId: 'APP_REG_CLIENT_ID',
					})(process.env),
					azureApiEndpoint: `https://${hostNames?.[0]}/`,
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
