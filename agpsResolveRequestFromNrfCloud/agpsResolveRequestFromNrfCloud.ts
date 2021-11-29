import { AzureFunction, Context } from '@azure/functions'
import { log, logError } from '../lib/log.js'
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
		binHoursString: 'AGPS_BIN_HOURS',
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
		agpsRequestsDatabaseName: 'AGPS_REQUESTS_DATABASE_NAME',
		agpsRequestsContainerName: 'AGPS_REQUESTS_CONTAINER_NAME',
	})({
		AGPS_BIN_HOURS: '1',
		AGPS_MAX_RESOLUTION_TIME_IN_MINUTES: '3',
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
			agpsRequestsDatabaseName,
			agpsRequestsContainerName,
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
			log(context),
			logError(context),
		)

		log(context)({
			nrfCloud: {
				endpoint,
				teamId,
			},
		})

		const { AccountEndpoint, AccountKey } = parseConnectionString(
			cosmosDbConnectionString,
		)
		const cosmosClient = new CosmosClient({
			endpoint: AccountEndpoint,
			key: AccountKey,
		})

		log(context)({
			cosmosDb: {
				database: agpsRequestsDatabaseName,
				container: agpsRequestsContainerName,
			},
		})

		cosmosDbContainer = cosmosClient
			.database(agpsRequestsDatabaseName)
			.container(agpsRequestsContainerName)

		binHours = parseInt(binHoursString, 10)
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

	const res = await resolver(request)
	log(context)({ res })
	const requestCacheKey = cacheKey({ request, binHours })
	const item = {
		id: requestCacheKey,
		...request,
		updatedAt: new Date().toISOString(),
		source: 'nrfcloud',
	} as Record<string, any>
	if (isLeft(res)) {
		logError(context)(`Resolution failed.`)
		logError(context)(res.left.message)
		item.unresolved = true
	} else {
		log(context)(`Resolved`)
		log(context)({ dataHex: res.right })
		item.unresolved = false
		item.dataHex = res.right
	}
	log(context)({
		item,
	})
	await cosmosDbContainer.items.upsert(item)
}

export default agpsResolveRequestFromNrfCloud
