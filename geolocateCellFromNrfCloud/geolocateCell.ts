import { CosmosClient } from '@azure/cosmos'
import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { DefaultAzureCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
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

const nrfCloudCellLocationServiceKeyPromise = (async () => {
	const { keyVaultName } = config()
	const credentials = new DefaultAzureCredential()
	const keyVaultClient = new SecretClient(
		`https://${keyVaultName}.vault.azure.net`,
		credentials,
	)
	const latestSecret = await keyVaultClient.getSecret(
		'nrfCloudCellLocationServiceKey',
	)
	return latestSecret.value as string
})()

const geolocateCell: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	try {
		config()
	} catch (error) {
		context.res = result(context)({ error: (error as Error).message }, 402)
		return
	}

	const {
		cell: c,
		area,
		mccmnc,
		nw,
	} = req.query as {
		cell: string
		area: string
		mccmnc: string
		nw: NetworkMode
	}

	if (nw === NetworkMode.NBIoT) {
		context.res = result(context)(
			{ error: 'Resolving NB-IoT cells is not yet supported.' },
			422,
		)
		return
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
		const sql = `SELECT c.lat AS lat, c.lng AS lng, c.accuracy FROM c WHERE c.cellId='${id}'`
		log(context)({ sql })
		const locations = (await container.items.query(sql).fetchAll()).resources

		log(context)({ locations })

		if (locations?.[0] !== undefined) {
			if (locations[0].lat !== undefined) {
				context.res = result(context)(locations[0])
			} else {
				context.res = result(context)({ error: `Unknown cell ${id}` }, 404)
			}
		} else {
			const { endpoint, teamId } = config()
			const c = apiClient({
				endpoint: new URL(endpoint),
				serviceKey: await nrfCloudCellLocationServiceKeyPromise,
				teamId,
			})

			const mccmnc = cell.mccmnc.toFixed(0)
			const payload: Static<typeof locateRequestSchema> = {
				// [cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [ NB-IoT is not yet supported
				lte: [
					{
						eci: cell.cell,
						mcc: parseInt(mccmnc.slice(0, Math.max(0, mccmnc.length - 2)), 10),
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
				context.res = result(context)(
					{ error: `Could not resolve cell ${id}` },
					404,
				)
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
				})
			} else {
				const location = {
					lat: maybeCellGeoLocation.lat,
					lng: maybeCellGeoLocation.lon,
					accuracy: maybeCellGeoLocation.uncertainty,
				}
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
					...location,
				})
				log(context)({ location })
				context.res = result(context)(location)
			}
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default geolocateCell
