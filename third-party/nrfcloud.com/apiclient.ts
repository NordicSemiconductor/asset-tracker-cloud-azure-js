import { Static, TObject, TProperties } from '@sinclair/typebox'
import Ajv from 'ajv'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { request as nodeRequest, RequestOptions } from 'https'
import jwt from 'jsonwebtoken'
import { URL } from 'url'
import { ErrorInfo, ErrorType } from '../../lib/ErrorInfo.js'
import { toQueryString } from './toQueryString.js'

const ajv = new Ajv()
// see @https://github.com/sinclairzx81/typebox/issues/51
ajv.addKeyword('kind')
ajv.addKeyword('modifier')

const validate =
	<Schema extends TObject<TProperties>>({
		schema,
		errorType,
		errorMessage,
	}: {
		schema: Schema
		errorType: ErrorType
		errorMessage: string
	}) =>
	(
		payload: Record<string, any>,
	): { error: ErrorInfo } | Static<typeof schema> => {
		const v = ajv.compile(schema)
		const valid = v(payload)
		if (valid !== true) {
			return {
				error: {
					type: errorType,
					message: errorMessage,
					detail: {
						errors: v.errors,
						input: payload,
					},
				},
			}
		}
		return payload as Static<typeof schema>
	}

const doRequest =
	({
		endpoint,
		serviceKey,
		teamId,
		method,
	}: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	({
		resource,
		payload,
		headers,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
	}) =>
	async () =>
		new Promise<Buffer>((resolve, reject) => {
			const options: RequestOptions = jsonRequestOptions({
				endpoint,
				resource,
				method,
				payload,
				teamId,
				serviceKey,
				headers,
			})

			console.debug(
				JSON.stringify({ doRequest: { options, payload } }, null, 2),
			)

			const req = nodeRequest(options, (res) => {
				const body: Buffer[] = []
				res.on('data', (d) => {
					body.push(d)
				})
				res.on('end', () => {
					console.debug(
						JSON.stringify({
							doRequest: {
								response: {
									statusCode: res.statusCode,
									headers: res.headers,
									body: Buffer.concat(body).toString(),
								},
							},
						}),
					)

					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						return reject(
							new Error(
								`Error ${res.statusCode}: "${new Error(
									Buffer.concat(body).toString('utf-8'),
								)}"`,
							),
						)
					}

					resolve(Buffer.concat(body))
				})
			})
			req.on('error', (e) => {
				reject(new Error(e.message))
			})
			if (method === 'POST') {
				req.write(JSON.stringify(payload))
			}
			req.end()
		})

const reqJSON =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	async <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
		responseSchema: Response
	}): Promise<{ error: ErrorInfo } | Static<typeof responseSchema>> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)

		if ('error' in maybeValidPayload) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (maybeValidPayload.error as Error).message,
				},
			}
		}

		const buffer = await doRequest(cfg)({
			resource,
			payload,
			headers: {
				...headers,
				'Content-Type': 'application/json',
			},
		})()

		try {
			return validate({
				schema: responseSchema,
				errorType: ErrorType.BadGateway,
				errorMessage: 'Response validation failed!',
			})(JSON.parse(buffer.toString('utf-8')))
		} catch (err) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: `Failed to parse payload as JSON "${buffer.toString(
						'utf-8',
					)}"`,
				},
			}
		}
	}

const head =
	({
		endpoint,
		serviceKey,
		teamId,
	}: {
		endpoint: URL
		serviceKey: string
		teamId: string
	}) =>
	async <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		method,
		requestSchema,
	}: {
		resource: string
		method: 'GET' | 'POST'
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
	}): Promise<{ error: ErrorInfo } | { headers: IncomingHttpHeaders }> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)

		if ('error' in maybeValidPayload) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (maybeValidPayload.error as Error).message,
				},
			}
		}

		return new Promise<{ headers: IncomingHttpHeaders }>((resolve, reject) => {
			const options: RequestOptions = {
				...jsonRequestOptions({
					endpoint,
					resource,
					method,
					payload,
					teamId,
					serviceKey,
					headers,
				}),
				method: 'HEAD',
			}

			const req = nodeRequest(options, (res) => {
				console.debug(
					JSON.stringify({
						head: {
							response: {
								statusCode: res.statusCode,
								headers: res.headers,
							},
						},
					}),
				)
				if (res.statusCode === undefined) {
					return reject(new Error('No response received!'))
				}
				if (res.statusCode >= 400) {
					return reject(new Error(`Error ${res.statusCode}`))
				}
				resolve({ headers: res.headers })
			})
			req.on('error', (e) => {
				reject(new Error(e.message))
			})
			req.end()
		})
	}

const reqBinary =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	async <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
	}): Promise<{ error: ErrorInfo } | Buffer> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)

		if ('error' in maybeValidPayload) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (maybeValidPayload.error as Error).message,
				},
			}
		}

		return doRequest(cfg)({
			resource,
			payload,
			headers: { ...headers, Accept: 'application/octet-stream' },
		})()
	}

export const apiClient = ({
	endpoint,
	serviceKey,
	teamId,
}: {
	endpoint: URL
	serviceKey: string
	teamId: string
}): {
	post: <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
		responseSchema: Response
	}) => Promise<{ error: ErrorInfo } | Static<typeof responseSchema>>
	get: <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
		responseSchema: Response
	}) => Promise<{ error: ErrorInfo } | Static<typeof responseSchema>>
	head: <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		method: 'GET' | 'POST'
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
	}) => Promise<{ error: ErrorInfo } | { headers: OutgoingHttpHeaders }>
	getBinary: <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
	}) => Promise<{ error: ErrorInfo } | Buffer>
} => ({
	post: reqJSON({
		endpoint,
		serviceKey,
		teamId,
		method: 'POST',
	}),
	get: reqJSON({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
	head: head({
		endpoint,
		serviceKey,
		teamId,
	}),
	getBinary: reqBinary({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
})
const jsonRequestOptions = ({
	endpoint,
	resource,
	method,
	payload,
	teamId,
	serviceKey,
	headers,
}: {
	endpoint: URL
	resource: string
	method: string
	payload: Record<string, any>
	teamId: string
	serviceKey: string
	headers: OutgoingHttpHeaders | undefined
}): RequestOptions => ({
	host: endpoint.hostname,
	port: 443,
	path: `${endpoint.pathname.replace(/\/+$/g, '')}/v1/${resource}${
		method === 'GET' ? `${toQueryString(payload)}` : ''
	}`,
	method,
	agent: false,
	headers: {
		Authorization: `Bearer ${jwt.sign({ aud: teamId }, serviceKey, {
			algorithm: 'ES256',
		})}`,
		...headers,
		...(method === 'POST'
			? {
					'Content-Length': JSON.stringify(payload).length,
			  }
			: {}),
	},
})
