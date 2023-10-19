import { lowerCaseRecord } from './lowerCaseRecord.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

void describe('lowerCaseRecord', () => {
	void it('should lower-case all keys', () =>
		assert.deepEqual(
			lowerCaseRecord({
				Foo: 'Bar', // will be overwritten by the next key
				foo: 'bar',
			}),
			{ foo: 'bar' },
		))
})
