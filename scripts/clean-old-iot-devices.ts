/**
 * Helper script to remove old test devices from the IoT Hub
 */
import { IotHubClient } from '@azure/arm-iothub'
import iothub from 'azure-iothub'
import { cliCredentials } from '../cli/cliCredentials.js'
import { fromEnv } from '../lib/fromEnv.js'
const { Registry } = iothub

const { resourceGroup } = fromEnv({
	resourceGroup: 'RESOURCE_GROUP',
})(process.env)

const creds = await cliCredentials()

console.log(creds)

const armIotHubClient = new IotHubClient(
	creds.credentials,
	creds.subscriptionId,
)

const iotHubInfo = await armIotHubClient.iotHubResource.get(
	resourceGroup,
	`${resourceGroup}IoTHub`,
)

// eslint-disable-next-line @typescript-eslint/await-thenable
const iotHubKeys = await armIotHubClient.iotHubResource.listKeys(
	resourceGroup,
	`${resourceGroup}IoTHub`,
)

let primaryKey: string | undefined = undefined

for await (const key of iotHubKeys) {
	primaryKey = key.primaryKey
	break
}

console.log(`IoT Hub`, iotHubInfo.properties?.hostName)

const iotHubConnectionString = `HostName=${iotHubInfo.properties?.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${primaryKey}`

const registry = Registry.fromConnectionString(iotHubConnectionString)
const devices = registry.createQuery(
	`SELECT deviceId FROM devices WHERE lastActivityTime < '${new Date(
		Date.now() - 24 * 60 * 60 * 1000,
	).toISOString()}'`,
)
const res = await devices.nextAsTwin()
const deviceIds = res.result.map(({ deviceId }) => deviceId)
const toDelete = deviceIds.filter((id) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
		id,
	),
)
const toSkip = deviceIds.filter(
	(id) =>
		!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
			id,
		),
)

console.log(`Skipping`, toSkip)
console.log(`Deleting`, toDelete)
await Promise.all(toDelete.map(async (device) => registry.delete(device)))
