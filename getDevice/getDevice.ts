import type { HttpHandler } from '@azure/functions'
import iothub from 'azure-iothub'
import { ErrorInfo, ErrorType, toStatusCode } from '../lib/ErrorInfo.js'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
const { Registry } = iothub

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const getDevice: HttpHandler = async (req, context) => {
	log(context)({ req })
	try {
		const devices = registry.createQuery(
			`SELECT * FROM devices WHERE deviceId='${req.params.id}'`,
		)
		const res = await devices.nextAsTwin()
		if (res.result.length === 0) {
			return result(context)(
				{
					type: ErrorType.EntityNotFound,
					message: `Device ${req.params.id} not found!`,
				} as ErrorInfo,
				toStatusCode[ErrorType.EntityNotFound],
			)
		} else {
			return result(context)(res.result[0])
		}
	} catch (error) {
		logError(context)({ error })
		return result(context)({ error: (error as Error).message }, 500)
	}
}

export default getDevice
