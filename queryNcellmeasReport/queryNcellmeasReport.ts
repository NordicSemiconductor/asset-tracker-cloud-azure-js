import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { log } from '../lib/log.js'
import { result } from '../lib/http.js'
import { CosmosClient } from '@azure/cosmos'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { fromEnv } from '../lib/fromEnv.js'

const { connectionString, databaseName, containerName } = fromEnv({
	connectionString: 'COSMOSDB_CONNECTION_STRING',
	databaseName: 'NCELLMEAS_REPORTS_DATABASE_NAME',
	containerName: 'NCELLMEAS_REPORTS_CONTAINER_NAME',
})(process.env)

const { AccountEndpoint, AccountKey } = parseConnectionString(connectionString)
const cosmosClient = new CosmosClient({
	endpoint: AccountEndpoint,
	key: AccountKey,
})

const container = cosmosClient.database(databaseName).container(containerName)

/**
 * Query historical device updates stored in Cosmos DB
 */
const queryHistoricalDeviceData: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	const { deviceId } = req.query as {
		deviceId: string
	}

	try {
		const res = await container.items
			.query(`SELECT * FROM c WHERE c.deviceId = "${deviceId}"`)
			.fetchNext()
		context.res = result(context)({
			items: res.resources.map(({ report, id, deviceId, timestamp, nw }) => ({
				id,
				deviceId,
				report,
				nw,
				timestamp,
			})),
			nextToken: res.hasMoreResults ? res.continuationToken : undefined, // FIXME: implement pagination
		})
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default queryHistoricalDeviceData
