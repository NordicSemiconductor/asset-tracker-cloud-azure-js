import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import azureIotHub from 'azure-iothub'
const { Registry } = azureIotHub
import { result } from '../lib/http.js'
import { ErrorInfo, ErrorType, toStatusCode } from '../lib/ErrorInfo.js'
import { log } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'
import * as url from 'url'
import { v4 } from 'uuid'

const { connectionString } = fromEnv({
	connectionString: 'IOT_HUB_CONNECTION_STRING',
})(process.env)

const updateDevice: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })
	try {
		const registry = Registry.fromConnectionString(connectionString)
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
			const { config: cfg, firmware, ...rest } = req.body

			log(context)({
				tags: rest,
				properties: {
					desired: {
						cfg,
						firmware,
					},
				},
			})

			if (firmware !== undefined) {
				const { fwPackageURI } = firmware
				const parsed = url.parse(fwPackageURI)
				firmware.fwLocation = {
					...parsed,
					path: parsed.path?.substr(1), // Remove leading slash
				}
				// See https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/include/net/azure_fota.html
				firmware.fwFragmentSize = firmware.fwFragmentSize ?? 1800
				firmware.jobId = firmware.jobId ?? v4()
			}

			await registry.updateTwin(
				req.params.id as string,
				{
					tags: rest,
					properties: {
						desired: {
							cfg,
							firmware,
						},
					},
				},
				res.result[0].etag,
			)

			context.res = result(context)({ success: true }, 202)
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default updateDevice
