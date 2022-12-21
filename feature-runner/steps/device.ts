import {
	InterpolatedStep,
	regexGroupMatcher,
	regexMatcher,
	StepRunnerFunc,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import * as chai from 'chai'
import { expect } from 'chai'
import chaiSubset from 'chai-subset'
import { readFile, writeFile } from 'fs/promises'
import { MqttClient } from 'mqtt'
import fetch from 'node-fetch'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { CAIntermediateFileLocations } from '../../cli/iot/certificates/caFileLocations.js'
import { createSimulatorKeyAndCSR } from '../../cli/iot/certificates/createSimulatorKeyAndCSR.js'
import {
	DeviceCertificateJSON,
	deviceFileLocations,
} from '../../cli/iot/certificates/deviceFileLocations.js'
import { generateDeviceCertificate } from '../../cli/iot/certificates/generateDeviceCertificate.js'
import { connectDevice } from './device/connectDevice.js'
import { deviceTopics } from './device/deviceTopics.js'
import { matchDeviceBoundTopic } from './device/matchDeviceBoundTopic.js'
chai.use(chaiSubset)

export const deviceStepRunners = ({
	certsDir,
	intermediateCertId,
	idScope,
}: {
	certsDir: string
	intermediateCertId: string
	idScope: string
}): ((step: InterpolatedStep) => StepRunnerFunc<any> | false)[] => {
	const connections = {} as Record<string, MqttClient>
	let fwResult = ''
	return [
		regexGroupMatcher(
			/^I generate a certificate for the (?:device|tracker) "(?<deviceId>[^"]+)"$/,
		)(async ({ deviceId }) => {
			await createSimulatorKeyAndCSR({ certsDir, deviceId, intermediateCertId })
			await generateDeviceCertificate({
				deviceId,
				certsDir,
				intermediateCertId,
			})

			const deviceFiles = deviceFileLocations({ certsDir, deviceId })
			const intermediateCAFiles = CAIntermediateFileLocations({
				certsDir,
				id: intermediateCertId,
			})
			const simulatorJSON: DeviceCertificateJSON = {
				clientId: deviceId,
				idScope,
				privateKey: await readFile(deviceFiles.privateKey, 'utf-8'),
				clientCert: [
					await readFile(deviceFiles.cert, 'utf-8'),
					await readFile(intermediateCAFiles.cert, 'utf-8'),
				].join(os.EOL),
				caCert: await readFile(
					path.resolve(process.cwd(), 'data', 'BaltimoreCyberTrustRoot.pem'),
					'utf-8',
				),
			}
			await writeFile(
				deviceFiles.json,
				JSON.stringify(simulatorJSON, null, 2),
				'utf-8',
			)
			return deviceId
		}),
		regexGroupMatcher(
			/^I connect the (?:device|tracker) "(?<deviceId>[^"]+)"$/,
		)(async ({ deviceId }) => {
			const connection = await connectDevice({
				deviceId,
				certsDir,
				intermediateCertId,
			})
			connections[deviceId] = connection
			return deviceId
		}),
		regexGroupMatcher(
			/^the (?:device|tracker) "(?<deviceId>[^"]+)" updates its reported state with$/,
		)(async ({ deviceId }, step) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const connection = connections[deviceId]
			connection.publish(
				deviceTopics.updateTwinReported(randomUUID()),
				JSON.stringify(reported),
			)
		}),
		regexGroupMatcher(
			/^the (?:device|tracker) "(?<deviceId>[^"]+)" publishes this message to the topic (?<topic>.+)$/,
		)(async ({ deviceId, topic }, step) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const message = JSON.parse(step.interpolatedArgument)
			const connection = connections[deviceId]
			connection.publish(topic, JSON.stringify(message))
		}),
		regexGroupMatcher(
			/^the (?:device|tracker) "(?<deviceId>[^"]+)" receives (?<messageCount>a|[1-9][0-9]*) (?<raw>raw )?messages? on the topic (?<topic>[^ ]+)(?: into "(?<storeName>[^"]+)")?$/,
		)(async ({ deviceId, messageCount, raw, topic, storeName }, _, runner) => {
			if (!topic.startsWith(`devices/${deviceId}/messages/devicebound`))
				throw new Error(
					`Must subscribe to the device topic devices/${deviceId}/messages/devicebound`,
				)
			const connection = connections[deviceId]
			const isRaw = raw !== undefined

			const expectedMessageCount =
				messageCount === 'a' ? 1 : parseInt(messageCount, 10)
			const messages: (Record<string, any> | string)[] = []

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(
						new Error(
							`timed out with ${
								expectedMessageCount - messages.length
							} message${expectedMessageCount > 1 ? 's' : ''} yet to receive.`,
						),
					)
				}, 60 * 1000)

				// @see https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support#receiving-cloud-to-device-messages
				connection.subscribe(`devices/${deviceId}/messages/devicebound/#`)

				const done = (result: any) => {
					connection.unsubscribe(`devices/${deviceId}/messages/devicebound/#`)
					resolve(result)
				}

				connection.on('message', async (t: string, message: Buffer) => {
					if (!matchDeviceBoundTopic(topic, t)) return
					await runner.progress(`Iot`, JSON.stringify(message))
					const m = isRaw
						? message.toString('hex')
						: JSON.parse(message.toString('utf-8'))
					messages.push(m)
					if (messages.length === expectedMessageCount) {
						clearTimeout(timeout)

						const result = messages.length > 1 ? messages : messages[0]

						if (storeName !== undefined) runner.store[storeName] = result

						if (isRaw) {
							if (messages.length > 1)
								return done(
									messages.map(
										(m) =>
											`(${
												Buffer.from(m as string, 'hex').length
											} bytes of data)`,
									),
								)
							return done(
								`(${
									Buffer.from(messages[0] as string, 'hex').length
								} bytes of data)`,
							)
						}

						return done(result)
					}
				})
			})
		}),
		regexGroupMatcher(
			/^the (?<desiredOrReported>desired|reported) state of the (?:device|tracker) "(?<deviceId>[^"]+)" (?:should )?(?<equalOrMatch>equals?|match(?:es)?)$/,
		)(async ({ desiredOrReported, deviceId, equalOrMatch }, step) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const j = JSON.parse(step.interpolatedArgument)
			const connection = connections[deviceId]
			const state: Record<string, any> = await new Promise(
				(resolve, reject) => {
					const getTwinPropertiesRequestId = randomUUID()
					const i = setTimeout(reject, 20000)
					connection.publish(
						deviceTopics.getTwinProperties(getTwinPropertiesRequestId),
						'',
					)
					connection.subscribe(
						deviceTopics.getTwinPropertiesAccepted(getTwinPropertiesRequestId),
					)
					connection.once('message', (topic, payload) => {
						if (
							topic !==
							deviceTopics.getTwinPropertiesAccepted(getTwinPropertiesRequestId)
						) {
							console.debug('[iot]', `Unexpected topic: ${topic}`)
							reject(new Error(`Unexpected topic: ${topic}`))
							clearInterval(i)
						}
						resolve(JSON.parse(payload.toString()))
						clearInterval(i)
					})
				},
			)
			const fragment = state[desiredOrReported]
			if (equalOrMatch.startsWith('match')) {
				expect(fragment).to.containSubset(j)
			} else {
				expect(fragment).to.deep.equal(j)
			}
			return state
		}),
		regexGroupMatcher(/^I download the firmware from (?<fwPackageURI>http.+)$/)(
			async ({ fwPackageURI }) => {
				const res = await fetch(fwPackageURI)
				expect(res.status).to.equal(200)
				fwResult = await (await res.blob()).text()
				return [fwPackageURI, fwResult]
			},
		),
		regexMatcher(/^the firmware file should contain this payload$/)(
			async (_, step) => {
				if (step.interpolatedArgument === undefined) {
					throw new Error('Must provide argument!')
				}
				expect(fwResult).to.equal(step.interpolatedArgument)
			},
		),
	]
}
