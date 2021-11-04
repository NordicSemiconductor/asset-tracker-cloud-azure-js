import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'

export const nrfCloudCellLocationServiceKeyPromise = (
	keyVaultName: string,
): (() => Promise<string>) => {
	const p = (async () => {
		const credentials = new DefaultAzureCredential()
		const keyVaultClient = new SecretClient(
			`https://${keyVaultName}.vault.azure.net`,
			credentials,
		)
		const latestSecret = await keyVaultClient.getSecret(
			'nrfCloudCellLocationServiceKey',
		)
		return latestSecret.value as string
	})()
	return async () => p
}
