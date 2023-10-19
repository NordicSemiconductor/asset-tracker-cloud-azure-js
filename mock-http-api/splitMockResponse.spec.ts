import { splitMockResponse } from './splitMockResponse.js'

describe('split mock response', () => {
	it('should parse headers and body', () =>
		expect(
			splitMockResponse(`Content-Type: application/octet-stream

(binary A-GNSS data) other types`),
		).toMatchObject({
			headers: {
				'Content-Type': 'application/octet-stream',
			},
			body: '(binary A-GNSS data) other types',
		}))
})
