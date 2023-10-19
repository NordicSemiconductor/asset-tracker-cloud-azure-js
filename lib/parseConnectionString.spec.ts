import { parseConnectionString } from './parseConnectionString.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
void describe('parseConnectionString', () => {
	void it('should parse a connection string', () => {
		assert.deepEqual(
			parseConnectionString(
				'AccountEndpoint=https://xxxx.documents.azure.com:443/;AccountKey=oKHTAxxx92GKkq3CDzeCd1WYnVslfIUaQqOa7Xw==;',
			),
			{
				AccountEndpoint: 'https://xxxx.documents.azure.com:443/',
				AccountKey: 'oKHTAxxx92GKkq3CDzeCd1WYnVslfIUaQqOa7Xw==',
			},
		)
	})
})
