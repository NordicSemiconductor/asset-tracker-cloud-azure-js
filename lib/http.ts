import { Context } from '@azure/functions'
import { log } from './log.js'

export const result =
	(context: Context) =>
	(
		result: unknown,
		status = 200,
		headers?: Record<string, string>,
	): {
		headers: Record<string, string>
		status: number
		body: unknown
	} => {
		const response = {
			headers: {
				'Content-Type': 'application/json; charset=uft-8',
				'Access-Control-Allow-Origin': '*',
				...headers,
			},
			status,
			body: result,
		}
		log(context)({ result })
		return response
	}
