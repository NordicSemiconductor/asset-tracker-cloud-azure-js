import { AzureCliCredentials } from '@azure/ms-rest-nodeauth'
import { resourceGroupName } from '../arm/resources'
import { setting } from './logging'

export const creds = async (): Promise<AzureCliCredentials> => {
	const creds = await AzureCliCredentials.create()

	const {
		tokenInfo: { subscription },
	} = creds

	setting('Subscription', subscription)
	setting('Resource Group', resourceGroupName())

	return creds
}
