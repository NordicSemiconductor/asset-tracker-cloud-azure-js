import type { InvocationContext } from '@azure/functions'
import { log } from './log.js'
import { lowerCaseRecord } from './lowerCaseRecord.js'
import type { BodyInit } from 'undici'

export const result =
	(context: InvocationContext) =>
	(
		result: unknown,
		status = 200,
		headers?: Record<string, string>,
		isRaw = false,
	): {
		headers: Record<string, string>
		status: number
		body: BodyInit
	} => {
		// @see https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=v2#response-object
		if (
			isRaw !== true &&
			(Array.isArray(result) || typeof result === 'object')
		) {
			result = JSON.stringify(result)
		}

		const response = {
			headers: lowerCaseRecord({
				'Content-Type': 'application/json; charset=utf-8',
				'Access-Control-Allow-Origin': '*',
				...headers,
			}),
			status,
			body: result as BodyInit,
		}

		log(context)(`> Status ${response.status}`)
		Object.entries(response.headers).map(([k, v]) =>
			log(context)(`> ${k}: ${v}`),
		)
		log(context)(`> Body`, result)
		log(context)(`> isRaw ${isRaw}`)

		return response
	}
