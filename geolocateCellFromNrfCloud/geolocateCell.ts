import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { CosmosClient } from '@azure/cosmos'
import {
	cellId,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { isLeft } from 'fp-ts/lib/Either.js'
import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { URL } from 'url'
import { TObject, TProperties, Type } from '@sinclair/typebox'

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

const locateRequestSchema = Type.Record(
	Type.Union([Type.Literal('nbiot'), Type.Literal('lte')]),
	Type.Array(
		Type.Object(
			{
				eci: Type.Integer({ minimum: 1 }),
				mcc: Type.Integer({ minimum: 100, maximum: 999 }),
				mnc: Type.Integer({ minimum: 1, maximum: 99 }),
				tac: Type.Integer({ minimum: 1 }),
			},
			{ additionalProperties: false },
		),
		{ minItems: 1 },
	),
)

const locateResultSchema = Type.Object({
	lat: Type.Number({ minimum: -90, maximum: 90 }),
	lon: Type.Number({ minimum: -180, maximum: 180 }),
	uncertainty: Type.Number({ minimum: 0 }),
})

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
			const maybeCellGeoLocation = await c.post({
				resource: 'location/cell',
				payload: {
					[cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [
						{
							eci: cell.cell,
							mcc: parseInt(mccmnc.substr(0, mccmnc.length - 2), 10),
							mnc: parseInt(mccmnc.substr(-2), 10),
							tac: cell.area,
						},
					],
				},
				requestSchema: locateRequestSchema as unknown as TObject<TProperties>,
				responseSchema: locateResultSchema,
			})()

			if (isLeft(maybeCellGeoLocation)) {
				logError(context)({ error: maybeCellGeoLocation.left.message })
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
					lat: maybeCellGeoLocation.right.lat,
					lng: maybeCellGeoLocation.right.lon,
					accuracy: maybeCellGeoLocation.right.uncertainty,
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
