import { CosmosClient } from '@azure/cosmos'
import type { CosmosDBOutput, HttpHandler } from '@azure/functions'
import {
	cellId,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import {
	locateRequestSchema,
	locateResultSchema,
} from '../third-party/nrfcloud.com/types.js'
import { nrfCloudServiceKeyPromise as fetchServiceKey } from '../third-party/nrfcloud.com/config.js'

const config = () =>
	fromEnv({
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'NRFCLOUD_API_ENDPOINT',
		teamId: 'NRFCLOUD_TEAM_ID',
	})(process.env)

const cosmosDbContainerPromise = (async () => {
	const { cosmosDbConnectionString } = config()
	const { AccountEndpoint, AccountKey } = parseConnectionString(
		cosmosDbConnectionString,
	)
	const cosmosClient = new CosmosClient({
		endpoint: AccountEndpoint,
		key: AccountKey,
	})

	return cosmosClient.database('cellGeolocation').container('nrfCloudCache')
})()

const geolocateCell =
	(cosmosDb: CosmosDBOutput): HttpHandler =>
	async (req, context) => {
		log(context)({
			req: { query: Object.fromEntries(req.query), params: req.params },
		})

		try {
			config()
		} catch (error) {
			return result(context)({ error: (error as Error).message }, 402)
		}

		const c = req.query.get('cell') as string
		const area = req.query.get('area') as string
		const mccmnc = req.query.get('mccmnc') as string
		const nw = req.query.get('nw') as NetworkMode

		if (nw === NetworkMode.NBIoT) {
			return result(context)(
				{ error: 'Resolving NB-IoT cells is not yet supported.' },
				422,
			)
		}

		const cell = {
			nw,
			cell: parseInt(c, 10),
			area: parseInt(area, 10),
			mccmnc: parseInt(mccmnc, 10),
		}
		const id = cellId(cell)

		try {
			const container = await cosmosDbContainerPromise
			const sql = `SELECT c.lat AS lat, c.lng AS lng, c.accuracy FROM c WHERE c.id='${id}'`
			log(context)({ sql })
			const locations = (await container.items.query(sql).fetchAll()).resources

			log(context)({ locations })

			if (locations?.[0] !== undefined) {
				if (locations[0].lat !== undefined) {
					return result(context)(locations[0])
				} else {
					return result(context)({ error: `Unknown cell ${id}` }, 404)
				}
			} else {
				const { endpoint, teamId, keyVaultName } = config()
				const c = apiClient({
					endpoint: new URL(endpoint),
					serviceKey: await fetchServiceKey(keyVaultName)(),
					teamId,
				})

				const mccmnc = cell.mccmnc.toFixed(0)
				const payload: Static<typeof locateRequestSchema> = {
					// [cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [ NB-IoT is not yet supported
					lte: [
						{
							eci: cell.cell,
							mcc: parseInt(
								mccmnc.slice(0, Math.max(0, mccmnc.length - 2)),
								10,
							),
							mnc: parseInt(mccmnc.slice(-2), 10),
							tac: cell.area,
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
					context.extraOutputs.set(
						'cellGeolocation',
						JSON.stringify({
							id,
							...cell,
						}),
					)
					return result(context)({ error: `Could not resolve cell ${id}` }, 404)
				} else {
					const location = {
						lat: maybeCellGeoLocation.lat,
						lng: maybeCellGeoLocation.lon,
						accuracy: maybeCellGeoLocation.uncertainty,
					}
					context.extraOutputs.set(
						cosmosDb,
						JSON.stringify({
							id,
							...cell,
							...location,
						}),
					)
					log(context)({ location })
					return result(context)(location)
				}
			}
		} catch (error) {
			logError(context)({ error })
			return result(context)({ error: (error as Error).message }, 500)
		}
	}

export default geolocateCell
