import { CommandDefinition } from './CommandDefinition.js'

export const cliConfigCommand = ({
	resourceGroup,
	appName,
	idScope,
	hostname,
}: {
	resourceGroup: string
	appName: string
	/**
	 * Promise that returns the idScope
	 */
	idScope: () => Promise<string>
	/**
	 * Promise that returns the IoT hub hostname
	 */
	hostname: () => Promise<string>
}): CommandDefinition => ({
	command: 'cli-config',
	action: async () => {
		console.log(
			`# Add this to your .envrc to configure the nRF Asset Tracker Azure CLI`,
		)
		for (const [k, v] of Object.entries({
			RESOURCE_GROUP: resourceGroup,
			APP_NAME: appName,
			AZURE_IOT_HUB_ID_SCOPE: await idScope(),
			AZURE_IOT_HUB_HOSTNAME: await hostname(),
		})) {
			console.log(`export ${k}=${v}`)
		}
	},
	help: 'Prints the CLI configuration.',
})
