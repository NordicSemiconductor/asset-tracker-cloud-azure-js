import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { log } from '../lib/log.js'
import { result } from '../lib/http.js'
import { fromEnv } from '../lib/fromEnv.js'
import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables'
import { v4 } from 'uuid'
import { URL } from 'url'
import { encodeQuery } from './encodeQuery.js'
import { setLogLevel } from '@azure/logger'

setLogLevel('verbose')

const { storageAccessKey, storageAccountName } = fromEnv({
	storageAccountName: 'STORAGE_ACCOUNT_NAME',
	storageAccessKey: 'STORAGE_ACCESS_KEY',
})(process.env)

const requestsClient = new TableClient(
	`https://${storageAccountName}.table.core.windows.net`,
	'Requests',
	new AzureNamedKeyCredential(storageAccountName, storageAccessKey),
)

const mockHTTPAPI: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	try {
		const url = `${req.method} ${new URL(req.url).pathname}${encodeQuery(
			req.query as Record<string, string>,
		)}`
		const requestId = v4()
		const testEntity = {
			partitionKey: requestId,
			rowKey: encodeURIComponent(url),
			method: req.method,
			path: new URL(req.url).pathname,
			query: JSON.stringify(req.query),
			url,
			headers: JSON.stringify(req.headers),
			body: req.rawBody,
		}
		await requestsClient.createEntity(testEntity)

		context.res = result(context)({ requestId })
	} catch (err) {
		context.res = result(context)((err as Error).message, 500)
		log(context)({ error: (err as Error).message })
	}
}

export default mockHTTPAPI
