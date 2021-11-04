import { Static } from '@sinclair/typebox'
import { ncellmeasReport } from './report'

export type StoredReport = {
	report: Static<typeof ncellmeasReport>
	deviceId: string
	nw: string
	timestamp: string
}
