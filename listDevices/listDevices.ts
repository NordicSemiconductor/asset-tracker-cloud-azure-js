import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import azureIotHub from 'azure-iothub'
const { Registry } = azureIotHub
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'

const { connectionString } = fromEnv({
	connectionString: 'IOT_HUB_CONNECTION_STRING',
})(process.env)

const listDevices: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })
	try {
		const registry = Registry.fromConnectionString(connectionString)
		const devices = registry.createQuery(
			'SELECT deviceId, tags.name FROM devices',
		)
		const res = await devices.nextAsTwin()
		context.res = result(context)(res.result)
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default listDevices
