import { AccessToken } from '@azure/core-auth'
import { AzureCliCredential } from '@azure/identity'
import fetch from 'node-fetch'

export const globalIotHubDPSHostname = 'global.azure-devices-provisioning.net'

export const ioTHubDPSInfo =
	({
		resourceGroupName,
		credentials,
	}: {
		resourceGroupName: string
		credentials:
			| {
					credentials: AzureCliCredential
					subscriptionId: string
			  }
			| (() => Promise<{
					credentials: AzureCliCredential
					subscriptionId: string
			  }>)
	}) =>
	async (): Promise<{
		hostname: string
		connectionString: string
	}> => {
		const creds =
			typeof credentials === 'function' ? await credentials() : credentials
		const token = (await creds.credentials.getToken([])) as AccessToken
		const subscriptionId = creds.subscriptionId

		return Promise.all([
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/provisioningServices/${resourceGroupName}ProvisioningService/listkeys?api-version=2018-01-22`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token.token}`,
						'Content-type': `application/json`,
					},
				},
			),
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/provisioningServices/${resourceGroupName}ProvisioningService?api-version=2018-01-22`,
				{
					headers: {
						Authorization: `Bearer ${token.token}`,
						'Content-type': `application/json`,
					},
				},
			),
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/IoTHubs/${resourceGroupName}IoTHub?api-version=2018-01-22`,
				{
					headers: {
						Authorization: `Bearer ${token.token}`,
						'Content-type': `application/json`,
					},
				},
			),
		])
			.then(
				async (res) =>
					Promise.all(res.map(async (r) => r.json())) as Promise<any[]>,
			)
			.then(
				([
					{ value },
					{
						properties: { serviceOperationsHostName },
					},
					{
						properties: { hostName },
					},
				]) => ({
					hostname: hostName as string,
					connectionString: `HostName=${serviceOperationsHostName};SharedAccessKeyName=provisioningserviceowner;SharedAccessKey=${value[0].primaryKey}`,
				}),
			)
	}
