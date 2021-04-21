import { AzureFunction, Context } from '@azure/functions'
import { result } from '../lib/http'

const getSignalRConnectionInfo: AzureFunction = async (
	context: Context,
	connectionInfo: {
		url: string
		accessToken: string
	},
): Promise<void> => {
	context.res = result(context)(connectionInfo)
}

export default getSignalRConnectionInfo
