import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import iothub from 'azure-iothub'
const { Registry } = iothub
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { ncellmeasReport } from '../ncellmeas/report.js'
import { isRight } from 'fp-ts/lib/Either.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const validateNcellmeasReport = validateWithJSONSchema(ncellmeasReport)

type ReportedUpdateWithNetwork = {
	properties: { reported: { dev?: { v: { nw: string } } } }
}

const deviceNetwork: Record<string, string> = {}

/**
 * Store neighbor cell measurement reports in Cosmos DB so it can be queried later
 */
const storeNcellmeasReportInCosmosDb: AzureFunction = async (
	context: Context,
	event: Static<typeof ncellmeasReport> | ReportedUpdateWithNetwork,
): Promise<void> => {
	log(context)({ context, event })

	const deviceId =
		context.bindingData.systemProperties['iothub-connection-device-id']

	// Handle TwinUpdates to store device network reports
	if (
		context.bindingData.systemProperties['iothub-message-source'] ===
			'twinChangeEvents' &&
		(event as ReportedUpdateWithNetwork).properties.reported.dev !== undefined
	) {
		const nw = (event as ReportedUpdateWithNetwork).properties.reported.dev?.v
			.nw as string
		deviceNetwork[deviceId] = nw
		log(context)(`${deviceId} => ${nw}`)
		return
	}

	// All other messages must be "ncellmeas"
	if (
		context.bindingData.systemProperties['iothub-message-source'] !==
		'Telemetry'
	) {
		log(context)(`Ignoring non-telemetry message`)
		return
	}
	if (context.bindingData?.properties?.ncellmeas === undefined) {
		log(context)(`Telemetry message does not have ncellmeas property set.`)
	}
	const valid = validateNcellmeasReport(event)
	if (isRight(valid)) {
		let nw = deviceNetwork[deviceId]
		if (nw === undefined) {
			const devices = registry.createQuery(
				`SELECT * FROM devices WHERE deviceId='${deviceId}'`,
			)
			const res = await devices.nextAsTwin()
			nw = res.result[0].properties.reported.dev?.v?.nw
		}
		const document = {
			report: valid.right,
			deviceId,
			nw,
			timestamp: context.bindingData.systemProperties['iothub-enqueuedtime'],
		}
		context.bindings.report = JSON.stringify(document)
		log(context)({ document })
	} else {
		console.error(JSON.stringify(valid.left))
	}
}

export default storeNcellmeasReportInCosmosDb
