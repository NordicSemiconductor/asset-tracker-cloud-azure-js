import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import iothub from 'azure-iothub'
const { Registry } = iothub
import { result } from '../lib/http.js'
import { ErrorInfo, ErrorType, toStatusCode } from '../lib/ErrorInfo.js'
import { log } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const getDevice: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })
	try {
		const devices = registry.createQuery(
			`SELECT * FROM devices WHERE deviceId='${req.params.id}'`,
		)
		const res = await devices.nextAsTwin()
		if (res.result.length === 0) {
			context.res = result(context)(
				{
					type: ErrorType.EntityNotFound,
					message: `Device ${req.params.id} not found!`,
				} as ErrorInfo,
				toStatusCode[ErrorType.EntityNotFound],
			)
		} else {
			context.res = result(context)(res.result[0])
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default getDevice
