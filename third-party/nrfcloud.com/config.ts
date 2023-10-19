import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'

export const nrfCloudServiceKeyPromise = (
	keyVaultName: string,
): (() => Promise<string>) => {
	const p = (async () => {
		const credentials = new DefaultAzureCredential()
		const keyVaultClient = new SecretClient(
			`https://${keyVaultName}.vault.azure.net`,
			credentials,
		)
		const latestSecret = await keyVaultClient.getSecret('nrfCloudServiceKey')
		return latestSecret.value as string
	})()
	return async () => p
}
