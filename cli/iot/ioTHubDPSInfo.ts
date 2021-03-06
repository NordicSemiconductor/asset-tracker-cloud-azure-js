import { AzureCliCredentials } from '@azure/ms-rest-nodeauth'
import fetch from 'node-fetch'

export const globalIotHubDPSHostname = 'global.azure-devices-provisioning.net'

export const ioTHubDPSInfo =
	({
		resourceGroupName,
		credentials,
	}: {
		resourceGroupName: string
		credentials: AzureCliCredentials | (() => Promise<AzureCliCredentials>)
	}) =>
	async (): Promise<{
		hostname: string
		connectionString: string
	}> => {
		const creds =
			typeof credentials === 'function' ? await credentials() : credentials
		const subscriptionId = creds.tokenInfo.subscription
		const token = await creds.getToken()

		return Promise.all([
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/provisioningServices/${resourceGroupName}ProvisioningService/listkeys?api-version=2018-01-22`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token.accessToken}`,
						'Content-type': `application/json`,
					},
				},
			),
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/provisioningServices/${resourceGroupName}ProvisioningService?api-version=2018-01-22`,
				{
					headers: {
						Authorization: `Bearer ${token.accessToken}`,
						'Content-type': `application/json`,
					},
				},
			),
			fetch(
				`https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Devices/IoTHubs/${resourceGroupName}IoTHub?api-version=2018-01-22`,
				{
					headers: {
						Authorization: `Bearer ${token.accessToken}`,
						'Content-type': `application/json`,
					},
				},
			),
		])
			.then(async (res) => Promise.all(res.map(async (r) => r.json())))
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
