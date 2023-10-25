import type { HttpHandler } from '@azure/functions'
import iothub from 'azure-iothub'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
const { Registry } = iothub

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const listDevices: HttpHandler = async (req, context) => {
	log(context)({ req })
	try {
		const devices = registry.createQuery(
			'SELECT deviceId, tags.name FROM devices',
		)
		const res = await devices.nextAsTwin()
		return result(context)(res.result)
	} catch (error) {
		logError(context)({ error })
		return result(context)({ error: (error as Error).message }, 500)
	}
}

export default listDevices
