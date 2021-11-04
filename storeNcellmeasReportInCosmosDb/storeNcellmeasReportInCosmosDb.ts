import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { ncellmeasReport } from '../ncellmeas/report.js'
import { isRight } from 'fp-ts/lib/Either.js'
import { Static } from '@sinclair/typebox'

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
		deviceNetwork[deviceId] = (event as ReportedUpdateWithNetwork).properties
			.reported.dev?.v.nw as string
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
		const document = {
			report: valid.right,
			deviceId,
			// TODO: implement lookup of value if not defined
			nw: deviceNetwork[deviceId],
		}
		context.bindings.report = JSON.stringify(document)
		log(context)({ document })
	} else {
		console.error(JSON.stringify(valid.left))
	}
}

export default storeNcellmeasReportInCosmosDb
