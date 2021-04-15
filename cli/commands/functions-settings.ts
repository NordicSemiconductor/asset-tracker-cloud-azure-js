import { CommandDefinition } from './CommandDefinition'
import { WebSiteManagementClient } from '@azure/arm-appservice'

export const functionsSettingsCommand = ({
	websiteClient,
	appName,
	resourceGroup,
}: {
	websiteClient: () => Promise<WebSiteManagementClient>
	appName: string
	resourceGroup: string
}): CommandDefinition => ({
	command: 'functions-settings',
	action: async () => {
		const client = await websiteClient()
		const { properties } = await client.webApps.listApplicationSettings(
			resourceGroup,
			`${appName}API`,
		)
		console.log(
			JSON.stringify(
				{
					IsEncrypted: false,
					Values: properties,
					Host: {
						CORS: '*',
						CORSCredentials: false,
					},
				},
				null,
				2,
			),
		)
	},
	help: 'Exports the function app setting for local development.',
})
