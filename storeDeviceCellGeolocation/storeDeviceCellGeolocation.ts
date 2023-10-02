import { CosmosClient } from '@azure/cosmos'
import { AzureFunction, Context } from '@azure/functions'
import {
	NetworkMode,
	cellId,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { exponential } from 'backoff'
import { randomUUID } from 'crypto'
import { batchToDoc } from '../lib/batchToDoc.js'
import { fromEnv } from '../lib/fromEnv.js'
import {
	BatchDeviceUpdate,
	DeviceUpdate,
	TwinChangeEvent,
} from '../lib/iotMessages.js'
import { log } from '../lib/log.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'

const { cosmosDbConnectionString } = fromEnv({
	cosmosDbConnectionString: 'COSMOSDB_CONNECTION_STRING',
})(process.env)

const { AccountEndpoint, AccountKey } = parseConnectionString(
	cosmosDbConnectionString,
)
const cosmosClient = new CosmosClient({
	endpoint: AccountEndpoint,
	key: AccountKey,
})

const container = cosmosClient.database('deviceMessages').container('updates')

/**
 * Query historical device updates stored in Cosmos DB
 */
const queryCellGeolocation: AzureFunction = async (
	context: Context,
	update: DeviceUpdate | BatchDeviceUpdate,
): Promise<void> => {
	log(context)({ update })
	const deviceId =
		context.bindingData.systemProperties['iothub-connection-device-id']

	type GnssUpdate = {
		v: { lat: number; lng: number; acc?: number }
		ts: number
	}
	const gnssUpdates: GnssUpdate[] = []

	if (context?.bindingData?.properties?.batch !== undefined) {
		log(context)({ batch: batchToDoc(update as BatchDeviceUpdate) })
		gnssUpdates.push(
			...(batchToDoc(update as BatchDeviceUpdate)
				.filter(({ gnss }) => gnss !== undefined)
				.map(({ gnss }) => gnss) as GnssUpdate[]),
		)
	} else {
		if ((update as TwinChangeEvent)?.properties?.reported?.gnss !== undefined) {
			gnssUpdates.push((update as TwinChangeEvent)?.properties?.reported?.gnss)
		}
	}

	if (gnssUpdates.length == 0) {
		return
	}

	log(context)({ gnssUpdates })

	const roamingPositions = (
		await Promise.all(
			gnssUpdates.map(
				async ({ ts, v }) =>
					new Promise((resolve) => {
						const sql = `SELECT
			 c.deviceUpdate.properties.reported.roam.v.cell AS cell,
			 c.deviceUpdate.properties.reported.roam.v.mccmnc AS mccmnc,
			 c.deviceUpdate.properties.reported.roam.v.area AS area
			 FROM c
			 WHERE c.deviceUpdate.properties.reported.roam.v != null
			 AND c.deviceId = "${deviceId}"
			 AND c.deviceUpdate.properties.reported.roam.ts < ${ts}
			 ORDER BY c.timestamp DESC
			 OFFSET 0 LIMIT 1
			 `
						log(context)({ sql })
						const b = exponential({
							randomisationFactor: 0,
							initialDelay: 1000,
							maxDelay: 5800,
						})
						b.failAfter(5)
						b.on('ready', async (attempt) => {
							log(context)({ attempt: attempt + 1 })
							const res: {
								cell: number
								mccmnc: number
								area: number
							}[] = (await container.items.query(sql).fetchAll()).resources
							log(context)({ res })
							if (res.length === 0) {
								b.backoff()
								return
							}
							const { cell, mccmnc, area } = res[0]
							resolve({
								cellId: cellId({
									nw: NetworkMode.LTEm, // FIXME: remove harcoded LTE-m network mode,
									cell,
									mccmnc,
									area,
								}),
								cell,
								mccmnc,
								area,
								lat: v.lat,
								lng: v.lng,
								acc: v.acc,
								ts,
								deviceId,
							})
						})
						b.on('fail', () => {
							resolve(undefined)
						})
						b.backoff()
					}),
			),
		)
	).filter((r) => r !== undefined) as {
		cellId: string
		cell: number
		mccmnc: number
		area: number
		lat: number
		lng: number
		acc?: number
		ts: number
	}[]

	log(context)({ roamingPositions })

	if (roamingPositions.length === 0) {
		return
	}

	// Persist in CosmosDB
	context.bindings.deviceCellGeolocation = JSON.stringify(
		roamingPositions.map((r) => ({
			id: randomUUID(),
			...r,
		})),
	)
}

export default queryCellGeolocation
