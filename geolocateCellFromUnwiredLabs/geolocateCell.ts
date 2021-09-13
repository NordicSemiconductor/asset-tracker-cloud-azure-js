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
import { resolveFromAPI } from './resolveFromAPI.js'
import { isLeft } from 'fp-ts/lib/Either.js'
import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'

const config = () =>
	fromEnv({
		connectionString: 'HISTORICAL_DATA_COSMOSDB_CONNECTION_STRING',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'UNWIREDLABS_API_ENDPOINT',
	})(process.env)

const cosmosDbContainerPromise = (async () => {
	const { connectionString } = config()
	const { AccountEndpoint, AccountKey } =
		parseConnectionString(connectionString)
	const cosmosClient = new CosmosClient({
		endpoint: AccountEndpoint,
		key: AccountKey,
	})

	return cosmosClient.database('cellGeolocation').container('unwiredLabsCache')
})()

const unwiredLabsApiKeyPromise = (async () => {
	const { keyVaultName } = config()
	const credentials = new DefaultAzureCredential()
	const keyVaultClient = new SecretClient(
		`https://${keyVaultName}.vault.azure.net`,
		credentials,
	)
	const unwiredLabsApiKeySecretName = 'unwiredLabsApiKey'

	const latestSecret = await keyVaultClient.getSecret(
		unwiredLabsApiKeySecretName,
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
			const { endpoint } = config()
			const maybeLocation = await resolveFromAPI({
				apiKey: await unwiredLabsApiKeyPromise,
				endpoint,
			})(
				{
					...cell,
					nw: cell.nw === NetworkMode.LTEm ? 'lte' : 'nbiot',
				},
				log(context),
			)
			if (isLeft(maybeLocation)) {
				logError(context)({ error: maybeLocation.left.message })
				context.res = result(context)(
					{ error: `Could not resolve cell ${id}` },
					404,
				)
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
				})
			} else {
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
					...maybeLocation.right,
				})
				log(context)({ location: maybeLocation.right })
				context.res = result(context)(maybeLocation.right)
			}
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default geolocateCell
