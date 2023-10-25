import { Container, CosmosClient } from '@azure/cosmos'
import type { StorageQueueHandler } from '@azure/functions'
import { Static } from '@sinclair/typebox'
import { URL } from 'url'
import { cacheKey } from '../agnss/cacheKey.js'
import { agnssRequestSchema } from '../agnss/types.js'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { resolveAgnssRequest } from './agnss.js'
import { nrfCloudServiceKeyPromise as fetchServiceKey } from '../third-party/nrfcloud.com/config.js'

const config = () =>
	fromEnv({
		binHoursString: 'AGNSS_BIN_HOURS',
		iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		maxResolutionTimeInMinutes: 'AGNSS_MAX_RESOLUTION_TIME_IN_MINUTES',
		initialDelayString: 'INITIAL_DELAY',
		delayFactorString: 'DELAY_FACTOR',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'NRFCLOUD_API_ENDPOINT',
		teamId: 'NRFCLOUD_TEAM_ID',
		agnssRequestsDatabaseName: 'AGNSS_REQUESTS_DATABASE_NAME',
		agnssRequestsContainerName: 'AGNSS_REQUESTS_CONTAINER_NAME',
	})({
		AGNSS_BIN_HOURS: '1',
		AGNSS_MAX_RESOLUTION_TIME_IN_MINUTES: '3',
		INITIAL_DELAY: '5',
		DELAY_FACTOR: '1.5',
		...process.env,
	})

let nrfCloudServiceKeyPromise: Promise<string>

/**
 * Resolve A-GNSS requests from nRF Cloud
 */
const agnssResolveRequestFromNrfCloud: StorageQueueHandler = async (
	queueEntry,
	context,
) => {
	const request = queueEntry as Static<typeof agnssRequestSchema>
	log(context)({ context, request })

	let resolver: ReturnType<typeof resolveAgnssRequest>
	let cosmosDbContainer: Container
	let binHours: number

	try {
		const {
			teamId,
			endpoint,
			keyVaultName,
			cosmosDbConnectionString,
			binHoursString,
			agnssRequestsDatabaseName,
			agnssRequestsContainerName,
		} = config()

		if (nrfCloudServiceKeyPromise === undefined)
			nrfCloudServiceKeyPromise = fetchServiceKey(keyVaultName)()
		resolver = resolveAgnssRequest(
			apiClient({
				endpoint: new URL(endpoint),
				serviceKey: await nrfCloudServiceKeyPromise,
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
				database: agnssRequestsDatabaseName,
				container: agnssRequestsContainerName,
			},
		})

		cosmosDbContainer = cosmosClient
			.database(agnssRequestsDatabaseName)
			.container(agnssRequestsContainerName)

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
	if ('error' in res) {
		logError(context)(`Resolution failed.`)
		logError(context)(res.error.message)
		item.unresolved = true
	} else {
		log(context)(`Resolved`)
		log(context)({ dataHex: res })
		item.unresolved = false
		item.dataHex = res
	}
	log(context)({
		item,
	})
	await cosmosDbContainer.items.upsert(item)
}

export default agnssResolveRequestFromNrfCloud
