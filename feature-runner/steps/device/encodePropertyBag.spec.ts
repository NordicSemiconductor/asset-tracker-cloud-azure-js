import { encodePropertyBag } from './encodePropertyBag.js'
import { describe, it, test } from 'node:test'
import assert from 'node:assert/strict'
void describe('encodePropertyBag', () => {
	for (const bag of [undefined, {}]) {
		void it(`should return an empty string for ${JSON.stringify(bag)}`, () =>
			assert.equal(encodePropertyBag(bag as any), ''))
	}

	void it('should encode a single nulled property', () =>
		assert.equal(encodePropertyBag({ batch: null }), 'batch'))

	void describe('it should encode properties', () => {
		for (const [props, expected] of [
			// Sample from https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support#receiving-cloud-to-device-messages
			// Note: "?" is not included.
			[
				{
					prop1: null,
					prop2: '',
					prop3: 'a string',
				},
				'prop1&prop2=&prop3=a%20string',
			],
			[
				{
					'$.ct': 'application/json',
					'$.ce': 'utf-8',
				},
				'%24.ct=application%2Fjson&%24.ce=utf-8',
			],
		]) {
			void test(`${JSON.stringify(props)} => ${JSON.stringify(expected)}`, () =>
				assert.equal(encodePropertyBag(props as any), expected))
		}
	})
	void describe('it should sort $ properties to the end', () => {
		for (const [props, expected] of [
			[
				{
					'$.ct': 'application/json',
					'$.ce': 'utf-8',
					prop1: null,
				},
				'prop1&%24.ct=application%2Fjson&%24.ce=utf-8',
			],
			[
				{
					'$.ct': 'application/json',
					prop1: null,
					'$.ce': 'utf-8',
					prop3: 'a string',
				},
				'prop1&prop3=a%20string&%24.ct=application%2Fjson&%24.ce=utf-8',
			],
		]) {
			void test(`${JSON.stringify(props)} => ${JSON.stringify(expected)}`, () =>
				assert.equal(encodePropertyBag(props as any), expected))
		}
	})
})
