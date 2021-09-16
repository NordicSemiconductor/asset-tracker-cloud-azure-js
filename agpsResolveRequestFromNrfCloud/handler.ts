import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { agpsRequestSchema } from '../agps/types.js'
import { Static } from '@sinclair/typebox'

/**
 * Resolve A-GPS requests from nRF Cloud
 */
const agpsResolveRequestFromNrfCloud: AzureFunction = async (
	context: Context,
	request: Static<typeof agpsRequestSchema>,
): Promise<void> => {
	log(context)({ context, request })
}

export default agpsResolveRequestFromNrfCloud
