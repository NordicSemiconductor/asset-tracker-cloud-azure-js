import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { result } from '../lib/http.js'
import { log } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { CosmosClient } from '@azure/cosmos'
import {
	cellId,
	cellFromGeolocations,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { isSome } from 'fp-ts/lib/Option'

const { connectionString } = fromEnv({
	connectionString: 'HISTORICAL_DATA_COSMOSDB_CONNECTION_STRING',
})(process.env)

const { AccountEndpoint, AccountKey } = parseConnectionString(connectionString)
const cosmosClient = new CosmosClient({
	endpoint: AccountEndpoint,
	key: AccountKey,
})

const container = cosmosClient
	.database('cellGeolocation')
	.container('deviceCellGeolocations')

const fromDeviceLocations = cellFromGeolocations({
	minCellDiameterInMeters: 5000,
	percentile: 0.9,
})

const geolocateCell: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	const { cell, area, mccmnc } = req.query as {
		cell: string
		area: string
		mccmnc: string
	}
	const c = cellId({
		nw: NetworkMode.LTEm, // FIXME: remove harcoded LTE-m network mode
		cell: parseInt(cell, 10),
		area: parseInt(area, 10),
		mccmnc: parseInt(mccmnc, 10),
	})

	try {
		const sql = `SELECT c.lat AS lat, c.lng AS lng FROM c WHERE c.cellId='${c}'`
		log(context)({ sql })
		const locations = (await container.items.query(sql).fetchAll()).resources

		log(context)({ locations })

		const location = fromDeviceLocations(locations)

		if (isSome(location)) {
			context.res = result(context)(location.value)
			log(context)({ location: location.value })
		} else {
			context.res = result(context)(
				{ error: `Could not resolve cell ${c}` },
				404,
			)
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default geolocateCell
