import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { result } from '../lib/http.js'

const getSignalRConnectionInfo: AzureFunction = async (
	context: Context,
	_: HttpRequest,
	connectionInfo: {
		url: string
		accessToken: string
	},
): Promise<void> => {
	context.res = result(context)(connectionInfo)
}

export default getSignalRConnectionInfo
