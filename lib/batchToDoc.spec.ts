import { batchToDoc } from './batchToDoc'

describe('batchToDoc', () => {
	it('should convert a batch document to multiple updates', () => {
		expect(
			batchToDoc({
				gnss: [
					{
						v: {
							lng: 8.669555,
							lat: 50.109177,
							acc: 28.032738,
							alt: 204.623276,
							spd: 0.698944,
							hdg: 0,
						},
						ts: 1567094051000,
					},
					{
						v: {
							lng: 10.424793,
							lat: 63.422975,
							acc: 12.276645,
							alt: 137.319351,
							spd: 6.308265,
							hdg: 77.472923,
						},
						ts: 1567165503000,
					},
				],
			}),
		).toEqual([
			{
				gnss: {
					v: {
						lng: 8.669555,
						lat: 50.109177,
						acc: 28.032738,
						alt: 204.623276,
						spd: 0.698944,
						hdg: 0,
					},
					ts: 1567094051000,
				},
			},
			{
				gnss: {
					v: {
						lng: 10.424793,
						lat: 63.422975,
						acc: 12.276645,
						alt: 137.319351,
						spd: 6.308265,
						hdg: 77.472923,
					},
					ts: 1567165503000,
				},
			},
		])
	})
})
