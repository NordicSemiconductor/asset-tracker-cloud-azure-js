import { Container, CosmosClient } from '@azure/cosmos'
import type { StorageQueueHandler } from '@azure/functions'
import { Static } from '@sinclair/typebox'
import { URL } from 'url'
import { fromEnv } from '../lib/fromEnv.js'
import { log, logError } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { cacheKey } from '../pgps/cacheKey.js'
import { gpsDay } from '../pgps/gpsTime.js'
import { pgpsRequestSchema } from '../pgps/types.js'
import { apiClient } from '../third-party/nrfcloud.com/apiclient.js'
import { resolvePgpsRequest } from './pgps.js'
import { nrfCloudServiceKeyPromise as fetchServiceKey } from '../third-party/nrfcloud.com/config.js'

const config = () =>
	fromEnv({
		binHoursString: 'PGPS_BIN_HOURS',
		iotHubConnectionString: 'IOTHUB_CONNECTION_STRING',
		cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
		storageAccountName: 'STORAGE_ACCOUNT_NAME',
		storageAccessKey: 'STORAGE_ACCESS_KEY',
		maxResolutionTimeInMinutes: 'PGPS_MAX_RESOLUTION_TIME_IN_MINUTES',
		initialDelayString: 'INITIAL_DELAY',
		delayFactorString: 'DELAY_FACTOR',
		keyVaultName: 'KEYVAULT_NAME',
		endpoint: 'NRFCLOUD_API_ENDPOINT',
		teamId: 'NRFCLOUD_TEAM_ID',
		pgpsRequestsDatabaseName: 'PGPS_REQUESTS_DATABASE_NAME',
		pgpsRequestsContainerName: 'PGPS_REQUESTS_CONTAINER_NAME',
	})({
		PGPS_BIN_HOURS: '1',
		PGPS_MAX_RESOLUTION_TIME_IN_MINUTES: '3',
		INITIAL_DELAY: '5',
		DELAY_FACTOR: '1.5',
		...process.env,
	})

let nrfCloudServiceKeyPromise: Promise<string>

/**
 * Resolve P-GPS requests from nRF Cloud
 */
const pgpsResolveRequestFromNrfCloud: StorageQueueHandler = async (
	queueEntry,
	context,
) => {
	const request = queueEntry as Static<typeof pgpsRequestSchema>
	log(context)({ context, request })

	let resolver: ReturnType<typeof resolvePgpsRequest>
	let cosmosDbContainer: Container
	let binHours: number

	try {
		const {
			teamId,
			endpoint,
			keyVaultName,
			cosmosDbConnectionString,
			binHoursString,
			pgpsRequestsDatabaseName,
			pgpsRequestsContainerName,
		} = config()

		if (nrfCloudServiceKeyPromise === undefined)
			nrfCloudServiceKeyPromise = fetchServiceKey(keyVaultName)()
		resolver = resolvePgpsRequest(
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
				database: pgpsRequestsDatabaseName,
				container: pgpsRequestsContainerName,
			},
		})

		cosmosDbContainer = cosmosClient
			.database(pgpsRequestsDatabaseName)
			.container(pgpsRequestsContainerName)

		binHours = parseInt(binHoursString, 10)
	} catch (error) {
		logError(context)({ error: (error as Error).message })
		return
	}

	const res = await resolver(request)
	log(context)({ res })
	const requestCacheKey = cacheKey({
		request,
		binHours,
		defaultGpsDay: gpsDay(),
	})
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
		log(context)(res)
		item.unresolved = false
		item.url = res
	}
	log(context)({
		item,
	})
	await cosmosDbContainer.items.upsert(item)
}

export default pgpsResolveRequestFromNrfCloud
