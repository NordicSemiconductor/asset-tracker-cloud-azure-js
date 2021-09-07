import { parse } from 'url'
import { request as nodeRequest, RequestOptions } from 'https'
import { left, right, Either } from 'fp-ts/lib/Either.js'

export const resolveFromAPI =
	({ apiKey, endpoint }: { apiKey: string; endpoint: string }) =>
	async (
		cell: {
			area: number
			mccmnc: number
			cell: number
			nw: 'nbiot' | 'lte'
		},
		debug?: (...args: any[]) => void,
	): Promise<Either<Error, { lat: number; lng: number; accuracy: number }>> => {
		try {
			const { hostname, path } = parse(endpoint)

			// See https://eu1.unwiredlabs.com/docs-html/index.html#response
			const {
				status,
				lat,
				lon,
				accuracy,
			}: {
				status: 'ok' | 'error'
				message?: string
				balance: number
				balance_slots?: number
				lat: number
				lon: number
				accuracy: number
				aged?: boolean
				fallback?: 'ipf' | 'lacf' | 'scf'
				// address: string (not requested)
				// address_details?: string (not requested)
			} = await new Promise((resolve, reject) => {
				const payload = JSON.stringify({
					token: apiKey,
					radio: cell.nw,
					mcc: Math.floor(cell.mccmnc / 100),
					mnc: cell.mccmnc % 100,
					cells: [
						{
							lac: cell.area,
							cid: cell.cell,
						},
					],
				})

				const options: RequestOptions = {
					host: hostname,
					path: `${path?.replace(/\/*$/, '') ?? ''}/v2/process.php`,
					method: 'POST',
					agent: false,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Content-Length': payload.length,
					},
				}

				debug?.({
					options,
				})

				const req = nodeRequest(options, (res) => {
					debug?.({
						response: {
							statusCode: res.statusCode,
							headers: res.headers,
						},
					})
					res.on('data', (d) => {
						const responseBody = JSON.parse(d.toString())
						debug?.({
							responseBody,
						})
						if ((res?.statusCode ?? 500) >= 400) {
							return reject(new Error(responseBody.description))
						}
						resolve(responseBody)
					})
					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.headers['content-length'] === '0') {
						return reject(new Error('No response received!'))
					}
				})

				req.on('error', (e) => {
					reject(new Error(e.message))
				})
				debug?.({ payload: payload.replace(apiKey, '***') })
				req.write(payload)
				req.end()
			})

			if (status === 'ok' && lat && lon) {
				return right({
					lat,
					lng: lon,
					accuracy,
				})
			}
			return left(new Error(`Failed to resolve.`))
		} catch (err) {
			return left(err as Error)
		}
	}
