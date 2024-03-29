import { CosmosClient, ItemResponse } from '@azure/cosmos'
import type { HttpHandler } from '@azure/functions'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { StoredReport } from '../ncellmeas/storedReport.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { nrfCloudServiceKeyPromise } from '../third-party/nrfcloud.com/config.js'
import {
	locateRequestSchema,
	locateResultSchema,
} from '../third-party/nrfcloud.com/types.js'

const config = () =>
	fromEnv({
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		cosmosDbDbName: 'NCELLMEAS_REPORTS_DATABASE_NAME',
		reportsCollectionName: 'NCELLMEAS_REPORTS_CONTAINER_NAME',
		resolvedReportsCollectionName:
			'NCELLMEAS_REPORTS_NRFCLOUD_LOCATION_CACHE_CONTAINER_NAME',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'NRFCLOUD_API_ENDPOINT',
		teamId: 'NRFCLOUD_TEAM_ID',
	})(process.env)

const cosmosDbClient = () => {
	const { cosmosDbConnectionString } = config()
	const { AccountEndpoint, AccountKey } = parseConnectionString(
		cosmosDbConnectionString,
	)
	return new CosmosClient({
		endpoint: AccountEndpoint,
		key: AccountKey,
	})
}

const reportsDbPromise = (async () => {
	const { reportsCollectionName, cosmosDbDbName } = config()
	return cosmosDbClient()
		.database(cosmosDbDbName)
		.container(reportsCollectionName)
})()

const resolvedReportsDbPromise = (async () => {
	const { resolvedReportsCollectionName, cosmosDbDbName } = config()
	return cosmosDbClient()
		.database(cosmosDbDbName)
		.container(resolvedReportsCollectionName)
})()

type ResolvedReport = {
	reportId: string
	resolved?: boolean
	location?: { lat: number; lng: number; accuracy: number }
}

const markAsFailed = async (reportId: string, entry: ItemResponse<any>) =>
	(await resolvedReportsDbPromise).item(entry.item.id).replace({
		id: entry.item.id,
		reportId,
		resolved: false,
	})

const markAsResolved = async (
	reportId: string,
	entry: ItemResponse<any>,
	location: { lat: number; lng: number; accuracy: number },
) =>
	(await resolvedReportsDbPromise).item(entry.item.id).replace({
		id: entry.item.id,
		reportId,
		resolved: true,
		location,
	})

const geolocateReport: HttpHandler = async (req, context) => {
	log(context)({ req })

	try {
		config()
	} catch (error) {
		return result(context)({ error: (error as Error).message }, 402)
	}

	const reportId = req.params.reportId
	let cacheEntry

	try {
		// Already resolved?
		const resolvedReportsContainer = await resolvedReportsDbPromise
		const resolvedReportsSql = `SELECT * FROM c WHERE c.reportId='${reportId}'`
		log(context)({ resolvedReportsSql })
		const resolvedReport: ResolvedReport | undefined = (
			await resolvedReportsContainer.items.query(resolvedReportsSql).fetchNext()
		).resources[0]
		if (resolvedReport !== undefined) {
			// Resolution in progress
			if (resolvedReport.resolved === undefined) {
				return result(context)(
					{ error: `Report ${reportId} resolution in progress.` },
					409,
				)
			}
			// Failed to resolve
			if (resolvedReport.resolved === false) {
				return result(context)(
					{ error: `Report ${reportId} could not be resolved.` },
					404,
				)
			}
			// Resolved
			return result(context)(resolvedReport.location)
		}

		// Add cache entry
		cacheEntry = await (
			await resolvedReportsDbPromise
		).items.create({ reportId })

		// Get the report
		const reportsContainer = await reportsDbPromise
		const reportsSql = `SELECT c.report FROM c WHERE c.id='${reportId}'`
		log(context)({ reportsSql })
		const report: StoredReport | undefined = (
			await reportsContainer.items.query(reportsSql).fetchNext()
		).resources[0]
		if (report === undefined) {
			// Mark resolution as failed
			await markAsFailed(reportId, cacheEntry)
			return result(context)({ error: `Report ${reportId} not found.` }, 404)
		}

		log(context)({ report })

		if (report.nw === NetworkMode.NBIoT) {
			// Mark resolution as failed
			await markAsFailed(reportId, cacheEntry)
			return result(context)(
				{ error: 'Resolving NB-IoT cells is not yet supported.' },
				422,
			)
		}

		// Resolve
		const { endpoint, teamId } = config()
		const c = apiClient({
			endpoint: new URL(endpoint),
			serviceKey: await nrfCloudServiceKeyPromise(config().keyVaultName)(),
			teamId,
		})

		const payload: Static<typeof locateRequestSchema> = {
			// Not yet supported
			// [cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [
			lte: [
				{
					mcc: report.report.mcc,
					mnc: report.report.mnc,
					eci: report.report.cell,
					tac: report.report.area,
					earfcn: report.report.earfcn,
					adv: report.report.adv,
					rsrp: report.report.rsrp,
					rsrq: report.report.rsrq,
					nmr: report.report.nmr?.map((n) => ({
						earfcn: n.earfcn,
						pci: n.cell,
						rsrp: n.rsrp,
						rsrq: n.rsrq,
					})),
				},
			],
		}
		const maybeCellGeoLocation = await c.post({
			resource: 'location/cell',
			payload,
			requestSchema: locateRequestSchema as unknown as TObject<TProperties>,
			responseSchema: locateResultSchema,
		})

		if ('error' in maybeCellGeoLocation) {
			logError(context)({ error: maybeCellGeoLocation.error.message })
			// Mark resolution as failed
			await markAsFailed(reportId, cacheEntry)
			return result(context)(
				{
					error: `Could not resolve report ${reportId}: ${maybeCellGeoLocation.error.message}`,
				},
				404,
			)
		} else {
			const location = {
				lat: maybeCellGeoLocation.lat,
				lng: maybeCellGeoLocation.lon,
				accuracy: maybeCellGeoLocation.uncertainty,
			}
			log(context)({ location })
			// Mark resolution as resolved
			await markAsResolved(reportId, cacheEntry, location)
			return result(context)(location)
		}
	} catch (error) {
		if (cacheEntry !== undefined) await markAsFailed(reportId, cacheEntry)
		logError(context)({ error: (error as Error).message })
		return result(context)({ error: (error as Error).message }, 500)
	}
}

export default geolocateReport
