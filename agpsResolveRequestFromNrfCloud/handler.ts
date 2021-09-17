import { AzureFunction, Context } from '@azure/functions'
import { log } from '../lib/log.js'
import { agpsRequestSchema } from '../agps/types.js'
import { Static } from '@sinclair/typebox'
import { fromEnv } from '../lib/fromEnv.js'
import { resolveAgpsRequest } from './agps.js'
import { URL } from 'url'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { Container, CosmosClient } from '@azure/cosmos'
import { isLeft } from 'fp-ts/lib/Either.js'
import { cacheKey } from '../agps/cacheKey.js'

const config = () =>
	fromEnv({
		binHoursString: 'BIN_HOURS',
		iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		maxResolutionTimeInMinutes: 'AGPS_MAX_RESOLUTION_TIME_IN_MINUTES',
		initialDelayString: 'INITIAL_DELAY',
		delayFactorString: 'DELAY_FACTOR',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'NRFCLOUD_API_ENDPOINT',
		teamId: 'NRFCLOUD_TEAM_ID',
	})({
		BIN_HOURS: '1',
		AGPS_MAX_RESOLUTION_TIME_IN_MINUTES: '15',
		INITIAL_DELAY: '5',
		DELAY_FACTOR: '1.5',
		...process.env,
	})

let nrfCloudAGPSLocationServiceKeyPromise: Promise<string>

const fetchNrfCloudAGPSLocationServiceKey = async ({
	keyVaultName,
}: {
	keyVaultName: string
}) => {
	const credentials = new DefaultAzureCredential()
	const keyVaultClient = new SecretClient(
		`https://${keyVaultName}.vault.azure.net`,
		credentials,
	)
	const latestSecret = await keyVaultClient.getSecret(
		'nrfCloudAGPSLocationServiceKey',
	)
	return latestSecret.value as string
}
/**
 * Resolve A-GPS requests from nRF Cloud
 */
const agpsResolveRequestFromNrfCloud: AzureFunction = async (
	context: Context,
	request: Static<typeof agpsRequestSchema>,
): Promise<void> => {
	log(context)({ context, request })

	let resolver: ReturnType<typeof resolveAgpsRequest>
	let cosmosDbContainer: Container
	let binHours: number

	try {
		const {
			teamId,
			endpoint,
			keyVaultName,
			cosmosDbConnectionString,
			binHoursString,
		} = config()

		if (nrfCloudAGPSLocationServiceKeyPromise === undefined)
			nrfCloudAGPSLocationServiceKeyPromise =
				fetchNrfCloudAGPSLocationServiceKey({ keyVaultName })
		resolver = resolveAgpsRequest(
			apiClient({
				endpoint: new URL(endpoint),
				serviceKey: await nrfCloudAGPSLocationServiceKeyPromise,
				teamId,
			}),
		)

		const { AccountEndpoint, AccountKey } = parseConnectionString(
			cosmosDbConnectionString,
		)
		const cosmosClient = new CosmosClient({
			endpoint: AccountEndpoint,
			key: AccountKey,
		})

		cosmosDbContainer = cosmosClient.database('agpsRequests').container('cache')

		binHours = parseInt(binHoursString, 10)
	} catch (error) {
		log(context)({ error: (error as Error).message })
		return
	}

	const res = await resolver(request)
	const requestCacheKey = cacheKey({ request, binHours })
	if (isLeft(res)) {
		await cosmosDbContainer.item(requestCacheKey).replace({
			cacheKey: requestCacheKey,
			...request,
			updatedAt: new Date().toISOString(),
			unresolved: true,
		})
	} else {
		await cosmosDbContainer.item(requestCacheKey).replace({
			cacheKey: requestCacheKey,
			...request,
			updatedAt: new Date().toISOString(),
			unresolved: false,
			dataHex: res.right,
		})
	}
}

export default agpsResolveRequestFromNrfCloud
