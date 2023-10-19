import { lowerCaseRecord } from './lowerCaseRecord.js'

describe('lowerCaseRecord', () => {
	it('should lower-case all keys', () =>
		expect(
			lowerCaseRecord({
				Foo: 'Bar', // will be overwritten by the next key
				foo: 'bar',
			}),
		).toMatchObject({ foo: 'bar' }))
})
