import type { CosmosDBOutput, InvocationContext } from '@azure/functions'
import { Static } from '@sinclair/typebox'
import iothub from 'azure-iothub'
import { randomUUID } from 'node:crypto'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { validateWithJSONSchema } from '../lib/validateWithJSONSchema.js'
import { ncellmeasReport } from '../ncellmeas/report.js'
import { StoredReport } from '../ncellmeas/storedReport.js'
const { Registry } = iothub

const { iotHubConnectionString } = fromEnv({
	iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
})(process.env)

const registry = Registry.fromConnectionString(iotHubConnectionString)

const validateNcellmeasReport = validateWithJSONSchema(ncellmeasReport)

type ReportedUpdateWithNetwork = {
	properties: { reported: { roam?: { v: { nw: string } } } }
}

type Context = Omit<InvocationContext, 'triggerMetadata'> & {
	triggerMetadata: {
		systemProperties: {
			'iothub-connection-device-id': string
			'iothub-message-source': string
			'iothub-enqueuedtime': string
		}
		properties?: {
			ncellmeas: string
		}
	}
}

const deviceNetwork: Record<string, string> = {}

/**
 * Store neighbor cell measurement reports in Cosmos DB so it can be queried later
 */
const storeNcellmeasReportInCosmosDb =
	(cosmosDb: CosmosDBOutput) =>
	async (
		event: Static<typeof ncellmeasReport> | ReportedUpdateWithNetwork,
		context: Context,
	): Promise<void> => {
		log(context)({ context, event })

		const deviceId =
			context.triggerMetadata.systemProperties['iothub-connection-device-id']

		// Handle TwinUpdates to store device network reports
		if (
			context.triggerMetadata.systemProperties['iothub-message-source'] ===
				'twinChangeEvents' &&
			(event as ReportedUpdateWithNetwork).properties?.reported?.roam !==
				undefined
		) {
			const nw = (event as ReportedUpdateWithNetwork).properties.reported.roam
				?.v.nw as string
			deviceNetwork[deviceId] = nw
			log(context)(`${deviceId} => ${nw}`)
			return
		}

		// All other messages must be "ncellmeas"
		if (
			context.triggerMetadata.systemProperties['iothub-message-source'] !==
			'Telemetry'
		) {
			log(context)(`Ignoring non-telemetry message`)
			return
		}
		if (context.triggerMetadata?.properties?.ncellmeas === undefined) {
			log(context)(`Telemetry message does not have ncellmeas property set.`)
		}
		const valid = validateNcellmeasReport(event)
		if ('error' in valid) {
			logError(context)(JSON.stringify(valid.error))
			return
		}
		let nw = deviceNetwork[deviceId]
		if (nw === undefined) {
			const devices = registry.createQuery(
				`SELECT * FROM devices WHERE deviceId='${deviceId}'`,
			)
			const res = await devices.nextAsTwin()
			nw = res.result[0].properties.reported.roam?.v?.nw
		}
		if (nw === undefined) {
			logError(context)(
				`Could not determine network mode for device ${deviceId}.`,
			)
		}
		const document: StoredReport & { id: string } = {
			id: randomUUID(),
			report: valid,
			deviceId,
			nw: nw ?? 'LTE-M',
			timestamp:
				context.triggerMetadata.systemProperties['iothub-enqueuedtime'],
		}
		context.extraOutputs.set(cosmosDb, document)
		log(context)({ document })
	}

export default storeNcellmeasReportInCosmosDb
