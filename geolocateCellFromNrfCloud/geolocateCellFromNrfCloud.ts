import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { result } from '../lib/http.js'
import { log, logError } from '../lib/log.js'
import { fromEnv } from '../lib/fromEnv.js'
import { parseConnectionString } from '../lib/parseConnectionString.js'
import { CosmosClient } from '@azure/cosmos'
import {
	cellId,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { isLeft, left, Either } from 'fp-ts/lib/Either.js'

const { connectionString } = fromEnv({
	connectionString: 'HISTORICAL_DATA_COSMOSDB_CONNECTION_STRING',
})(process.env)

const { cellLocationServiceKey, endpoint, teamId } = (() => {
	try {
		return fromEnv({
			cellLocationServiceKey: 'NRFCLOUD_LOCATION_SERVICE_KEY',
			endpoint: 'NRFCLOUD_LOCATION_API_ENDPOINT',
			teamId: 'NRFCLOUD_LOCATION_TEAM_ID',
		})(process.env)
	} catch {
		console.warn(`No nRF Cloud Cell Location key defined. Disabling lookups.`)
		return {
			cellLocationServiceKey: undefined,
			endpoint: undefined,
			teamId: undefined,
		}
	}
})()

console.log({ cellLocationServiceKey, endpoint, teamId })

const { AccountEndpoint, AccountKey } = parseConnectionString(connectionString)
const cosmosClient = new CosmosClient({
	endpoint: AccountEndpoint,
	key: AccountKey,
})

const container = cosmosClient
	.database('cellGeolocation')
	.container('nrfCloudCache')

const geolocateCellFromNrfCloud: AzureFunction = async (
	context: Context,
	req: HttpRequest,
): Promise<void> => {
	log(context)({ req })

	const {
		cell: c,
		area,
		mccmnc,
		nw,
	} = req.query as {
		cell: string
		area: string
		mccmnc: string
		nw: NetworkMode
	}
	const cell = {
		nw,
		cell: parseInt(c, 10),
		area: parseInt(area, 10),
		mccmnc: parseInt(mccmnc, 10),
	}
	const id = cellId(cell)

	try {
		const sql = `SELECT c.lat AS lat, c.lng AS lng, c.accuracy FROM c WHERE c.cellId='${id}'`
		log(context)({ sql })
		const locations = (await container.items.query(sql).fetchAll()).resources

		log(context)({ locations })

		if (locations?.[0] !== undefined) {
			if (locations[0].lat !== undefined) {
				context.res = result(context)(locations[0])
			} else {
				context.res = result(context)({ error: `Unknown cell ${id}` }, 404)
			}
		} else {
			const maybeLocation: Either<
				Error,
				{ lat: number; lng: number; accuracy: number }
			> = left<Error>(new Error(`Not implemented.`))
			if (isLeft(maybeLocation)) {
				logError(context)({ error: maybeLocation.left.message })
				context.res = result(context)(
					{ error: `Could not resolve cell ${id}` },
					404,
				)
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
				})
			} else {
				context.bindings.cellGeolocation = JSON.stringify({
					cellId: id,
					...cell,
					...maybeLocation.right,
				})
				log(context)({ location: maybeLocation.right })
				context.res = result(context)(maybeLocation.right)
			}
		}
	} catch (error) {
		context.log.error({ error })
		context.res = result(context)({ error: (error as Error).message }, 500)
	}
}

export default geolocateCellFromNrfCloud
