import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { log } from '../lib/log'
import { result } from '../lib/http'
import { CosmosClient } from '@azure/cosmos'
import { parseConnectionString } from '../lib/parseConnectionString'
import { fromEnv } from '../lib/fromEnv'

const { connectionString } = fromEnv({
	connectionString: 'HISTORICAL_DATA_COSMOSDB_CONNECTION_STRING',
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
const queryHistoricalDeviceData: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })
	try {
		const res = {
			result: (await container.items.query(req.body.query).fetchAll())
				.resources,
		}
		context.res = result(context)(res)
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default queryHistoricalDeviceData
