import { CosmosClient } from '@azure/cosmos'
import type { HttpHandler } from '@azure/functions'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'

const { connectionString } = fromEnv({
	connectionString: 'COSMOSDB_CONNECTION_STRING',
})(process.env)

const { AccountEndpoint, AccountKey } = parseConnectionString(connectionString)
const cosmosClient = new CosmosClient({
	endpoint: AccountEndpoint,
	key: AccountKey,
})

const container = cosmosClient.database('deviceMessages').container('updates')

/**
 * Query historical device updates stored in Cosmos DB
 */
const queryHistoricalDeviceData: HttpHandler = async (req, context) => {
	log(context)({ req })
	try {
		const { query } = (await req.json()) as Record<string, any>
		const res = {
			result: (await container.items.query(query).fetchAll()).resources,
		}
		return result(context)(res)
	} catch (error) {
		logError(context)({ error })
		return result(context)({ error: (error as Error).message }, 500)
	}
}

export default queryHistoricalDeviceData
