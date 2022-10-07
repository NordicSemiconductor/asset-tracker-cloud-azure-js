import { CommandDefinition } from './CommandDefinition.js'

export const cliConfigCommand = ({
	resourceGroup,
	appName,
}: {
	resourceGroup: string
	appName: string
}): CommandDefinition => ({
	command: 'cli-config',
	action: async () => {
		console.log(
			`# Add this to your .envrc to configure the nRF Asset Tracker Azure CLI`,
		)
		for (const [k, v] of Object.entries({
			RESOURCE_GROUP: resourceGroup,
			APP_NAME: appName,
		})) {
			console.log(`export ${k}=${v}`)
		}
	},
	help: 'Prints the CLI configuration.',
})
