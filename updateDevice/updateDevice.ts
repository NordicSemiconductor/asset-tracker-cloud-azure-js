import type { HttpHandler } from '@azure/functions'
import iothub from 'azure-iothub'
import { randomUUID } from 'node:crypto'
import * as url from 'url'
import { ErrorInfo, ErrorType, toStatusCode } from '../lib/ErrorInfo.js'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
const { Registry } = iothub

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const updateDevice: HttpHandler = async (req, context) => {
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
			const {
				config: cfg,
				firmware,
				...rest
			} = (await req.json()) as Record<string, any>

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
					path: parsed.path?.slice(1), // Remove leading slash
				}
				// See https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/include/net/azure_fota.html
				firmware.fwFragmentSize = firmware.fwFragmentSize ?? 1800
				firmware.jobId = firmware.jobId ?? randomUUID()
			}

			await registry.updateTwin(
				req.params.id,
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

			return result(context)({ success: true }, 202)
		}
	} catch (error) {
		logError(context)({ error })
		return result(context)({ error: (error as Error).message }, 500)
	}
}

export default updateDevice
