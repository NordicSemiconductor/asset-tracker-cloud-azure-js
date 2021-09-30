import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import iothub from 'azure-iothub'
const { Registry } = iothub
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const listDevices: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })
	try {
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
