import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import iothub from 'azure-iothub'
import { ErrorInfo, ErrorType, toStatusCode } from '../lib/ErrorInfo.js'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
const { Registry } = iothub

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const deleteDevice: AzureFunction = async (
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
		}
		await registry.delete(req.params.id)
		context.res = result(context)({ success: true }, 202)
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default deleteDevice
