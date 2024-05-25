import type { Static } from '@sinclair/typebox'
import type { ncellmeasReport } from './report.js'

export type StoredReport = {
	report: Static<typeof ncellmeasReport>
	deviceId: string
	nw: string
	timestamp: string
}
