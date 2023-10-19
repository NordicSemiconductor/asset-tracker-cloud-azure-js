import { flattenDependencies } from './flattenDependencies.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
void describe('flattenDependencies', () => {
	void it('should flatten dependencies', () =>
		assert.deepEqual(
			flattenDependencies({
				'/mock-http-api/mock-http-api.js': {
					'/lib/log.js': {},
					'/lib/http.js': {
						'/lib/log.js': {},
						'/lib/request.js': {},
					},
					'/lib/fromEnv.js': {},
				},
			}),
			[
				'/lib/fromEnv.js',
				'/lib/http.js',
				'/lib/log.js',
				'/lib/request.js',
				'/mock-http-api/mock-http-api.js',
			],
		))
})
