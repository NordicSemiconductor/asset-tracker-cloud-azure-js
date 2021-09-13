import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { log } from '../lib/log.js'
import { result } from '../lib/http.js'
import { fromEnv } from '../lib/fromEnv.js'
import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables'
import { v4 } from 'uuid'
import { URL } from 'url'
import { encodeQuery } from './encodeQuery.js'
import { setLogLevel } from '@azure/logger'
import { splitMockResponse } from './splitMockResponse.js'

setLogLevel('verbose')

const { storageAccessKey, storageAccountName } = fromEnv({
	storageAccountName: 'STORAGE_ACCOUNT_NAME',
	storageAccessKey: 'STORAGE_ACCESS_KEY',
})(process.env)

const createTableClient = (table: string) =>
	new TableClient(
		`https://${storageAccountName}.table.core.windows.net`,
		table,
		new AzureNamedKeyCredential(storageAccountName, storageAccessKey),
	)

const requestsClient = createTableClient('Requests')
const responsesClient = createTableClient('Responses')

const mockHTTPAPI: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	try {
		const path = new URL(req.url).pathname.replace(/^\/api\//, '')
		const methodPathQuery = `${req.method} ${path}${encodeQuery(
			req.query as Record<string, string>,
		)}`
		const requestId = v4()
		const request = {
			partitionKey: requestId,
			rowKey: encodeURIComponent(methodPathQuery),
			method: req.method,
			path: path,
			query: JSON.stringify(req.query),
			methodPathQuery: methodPathQuery,
			headers: JSON.stringify(req.headers),
			body: JSON.stringify(req.body),
		}
		log(context)({ request })
		await requestsClient.createEntity(request)

		// Check if response exists
		log(context)(`Checking if response exists for ${methodPathQuery}...`)

		const res = responsesClient.listEntities<{
			partitionKey: string
			rowKey: string
			methodPathQuery: string
			statusCode: number
			body?: string
			ttl: number
		}>({
			queryOptions: {
				filter: `methodPathQuery eq '${methodPathQuery}' and ttl ge ${Math.floor(
					Date.now() / 1000,
				)}`,
			},
		})

		for await (const response of res) {
			log(context)({ response })
			await responsesClient.deleteEntity(response.partitionKey, response.rowKey)
			const { body, headers } = splitMockResponse(response.body ?? '')
			const isBinary = /^[0-9a-f]+$/.test(body)
			context.res = result(context)(
				isBinary
					? /* body is HEX encoded */ Buffer.from(body, 'hex').toString(
							'base64',
					  )
					: body,
				response.statusCode ?? 200,
				isBinary
					? {
							...headers,
							'Content-Type': 'application/octet-stream',
					  }
					: headers,
			)
			return
		}
		context.res = result(context)('', 404)
	} catch (err) {
		context.res = result(context)((err as Error).message, 500)
		log(context)({ error: (err as Error).message })
	}
}

export default mockHTTPAPI
