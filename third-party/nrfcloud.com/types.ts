import { Type } from '@sinclair/typebox'
import {
	PositiveInteger,
	RSRP,
	RSRQ,
	TimingAdvance,
} from '../../ncellmeas/report.js'

export const locateRequestSchema = Type.Record(
	Type.Union([
		Type.Literal('lte'),
		// Not yet supported
		// Type.Literal('nbiot'),
	]),
	Type.Array(
		Type.Object(
			{
				mcc: Type.Integer({ minimum: 100, maximum: 999 }),
				mnc: Type.Integer({ minimum: 0, maximum: 99 }),
				eci: PositiveInteger,
				tac: PositiveInteger,
				earfcn: Type.Optional(PositiveInteger),
				adv: Type.Optional(TimingAdvance),
				rsrp: Type.Optional(RSRP),
				rsrq: Type.Optional(RSRQ),
				nmr: Type.Optional(
					Type.Array(
						Type.Object(
							{
								pci: PositiveInteger,
								earfcn: PositiveInteger,
								rsrp: RSRP,
								rsrq: RSRQ,
							},
							{ additionalProperties: false },
						),
						{ minItems: 1 },
					),
				),
			},
			{ additionalProperties: false },
		),
		{ minItems: 1 },
	),
)

export const locateResultSchema = Type.Object({
	lat: Type.Number({ minimum: -90, maximum: 90 }),
	lon: Type.Number({ minimum: -180, maximum: 180 }),
	uncertainty: Type.Number({ minimum: 0 }),
})
