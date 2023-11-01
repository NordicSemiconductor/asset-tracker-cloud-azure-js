import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables'
import type { HttpHandler } from '@azure/functions'
import { setLogLevel } from '@azure/logger'
import { randomUUID } from 'node:crypto'
import { URL } from 'url'
import { fromEnv } from '../lib/fromEnv.js'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'

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

const mockHTTPAPI: HttpHandler = async (req, context) => {
	const query = Object.fromEntries(req.query)
	const headers = Object.fromEntries(req.headers)

	log(context)({
		req: {
			params: req.params,
			query,
			headers,
		},
	})

	try {
		const path = new URL(req.url).pathname.replace(/^\/api\//, '')
		req.query.sort()
		const pathWithQuery = `${path}${
			req.query.size > 0 ? '?' : ''
		}${req.query.toString()}`
		const methodPathQuery = `${req.method} ${pathWithQuery}`
		const requestId = randomUUID()
		const request = {
			partitionKey: requestId,
			rowKey: encodeURIComponent(methodPathQuery),
			method: req.method,
			path,
			query: JSON.stringify(query),
			methodPathQuery,
			headers: JSON.stringify(headers),
			body: await req.text(),
		}
		log(context)({ request })
		await requestsClient.createEntity(request)

		// Check if response exists
		log(context)(`Checking if response exists for ${methodPathQuery}...`)

		const entities = responsesClient.listEntities<{
			partitionKey: string
			rowKey: string
			methodPathQuery: string
			statusCode: number
			body?: string
			headers?: string
			ttl: number
		}>({
			queryOptions: {
				filter: `methodPathQuery eq '${methodPathQuery}' and ttl ge ${Math.floor(
					Date.now() / 1000,
				)}`,
			},
		})

		for await (const response of entities) {
			log(context)({ response })
			await responsesClient.deleteEntity(response.partitionKey, response.rowKey)
			const isBinary = /^[0-9a-f]+$/.test(response.body ?? '')
			const headers =
				response.headers !== undefined ? JSON.parse(response.headers) : {}

			if (isBinary) {
				const binaryBody = Buffer.from(response.body as string, 'hex')
				return result(context)(
					binaryBody,
					response.statusCode ?? 200,
					{
						'content-type': 'application/octet-stream',
						'content-length': `${binaryBody.length}`,
						...headers,
					},
					true,
				)
			} else {
				return result(context)(
					response.body ?? '',
					response.statusCode ?? 200,
					{
						'content-length': `${(response.body ?? '').length}`,
						...headers,
					},
					false,
				)
			}
		}
		return result(context)('', 404)
	} catch (err) {
		logError(context)({ error: (err as Error).message })
		return result(context)((err as Error).message, 500)
	}
}

export default mockHTTPAPI
