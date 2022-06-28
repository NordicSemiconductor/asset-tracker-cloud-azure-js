import { CosmosClient } from '@azure/cosmos'
import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'

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

	const { deviceId, limit: limitString } = req.query as {
		deviceId: string
		limit: string
	}

	const limit = parseInt(limitString ?? '10', 10)

	try {
		const res = await container.items
			.query(
				`SELECT * FROM c WHERE c.deviceId = "${deviceId}" ORDER BY c.timestamp DESC OFFSET 0 LIMIT ${limit}`,
			)
			.fetchNext()
		context.res = result(context)({
			items: (res.resources ?? []).map(
				({ report, id, deviceId, timestamp, nw }) => ({
					id,
					deviceId,
					report,
					nw,
					timestamp,
				}),
			),
			nextToken: res.hasMoreResults ? res.continuationToken : undefined, // FIXME: implement pagination
		})
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default queryHistoricalDeviceData
