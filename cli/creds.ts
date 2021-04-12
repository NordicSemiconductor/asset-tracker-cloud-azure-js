import * as chalk from 'chalk'
import { AzureCliCredentials } from '@azure/ms-rest-nodeauth'
import { resourceGroupName } from '../arm/resources'

export const creds = async (): Promise<AzureCliCredentials> => {
	const creds = await AzureCliCredentials.create()

	const {
		tokenInfo: { subscription },
	} = creds

	console.error(chalk.magenta('Subscription:'), chalk.yellow(subscription))
	console.error(
		chalk.magenta('Resource Group:'),
		chalk.yellow(resourceGroupName()),
	)

	return creds
}
