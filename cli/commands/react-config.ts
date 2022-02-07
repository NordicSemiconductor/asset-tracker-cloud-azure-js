import { WebSiteManagementClient } from '@azure/arm-appservice'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { fromEnv } from '../../lib/fromEnv.js'
import { CommandDefinition } from './CommandDefinition.js'

export const reactConfigCommand = ({
	websiteClient,
	appName,
	resourceGroup,
}: {
	websiteClient: () => Promise<WebSiteManagementClient>
	appName: string
	resourceGroup: string
}): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const { hostNames } = await websiteClient().then(async (client) =>
			client.webApps.get(resourceGroup, `${appName}api`),
		)
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
				{
					prefix: 'REACT_APP_',
					quote: '',
				},
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
