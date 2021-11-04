import { Type } from '@sinclair/typebox'

export const PositiveInteger = Type.Integer({
	minimum: 1,
	title: 'positive integer',
})
export const RSRP = Type.Integer({ minimum: -199, maximum: 0, title: 'RSRP' })
export const RSRQ = Type.Integer({ minimum: -99, maximum: 0, title: 'RSRQ' })
export const TimingAdvance = Type.Integer({
	minimum: 0,
	maximum: 65535,
	title: 'Timing advance',
})

/** @see https://nordicsemiconductor.github.io/asset-tracker-cloud-docs/saga/docs/cloud-protocol/ncellmeas.schema.json */
export const ncellmeasReport = Type.Object({
	mcc: Type.Integer({ minimum: 100, maximum: 999 }),
	mnc: Type.Integer({ minimum: 0, maximum: 99 }),
	cell: PositiveInteger,
	area: PositiveInteger,
	earfcn: PositiveInteger,
	adv: TimingAdvance,
	rsrp: RSRP,
	rsrq: RSRQ,
	nmr: Type.Optional(
		Type.Array(
			Type.Object(
				{
					cell: PositiveInteger,
					earfcn: PositiveInteger,
					rsrp: RSRP,
					rsrq: RSRQ,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1 },
		),
	),
	ts: PositiveInteger,
})
