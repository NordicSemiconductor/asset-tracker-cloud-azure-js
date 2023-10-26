import type { FunctionInput, HttpHandler } from '@azure/functions'
import { result } from '../lib/http.js'

const getSignalRConnectionInfo =
	(signalRConnectionInfo: FunctionInput): HttpHandler =>
	async (_, context) => {
		const connectionInfo = context.extraInputs.get(signalRConnectionInfo) as {
			url: string
			accessToken: string
		}
		return result(context)(connectionInfo)
	}

export default getSignalRConnectionInfo
