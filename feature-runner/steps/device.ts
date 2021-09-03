import {
	regexGroupMatcher,
	StepRunnerFunc,
	InterpolatedStep,
	regexMatcher,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { generateDeviceCertificate } from '../../cli/iot/generateDeviceCertificate.js'
import { connectDevice } from '../../cli/iot/connectDevice.js'
import { MqttClient } from 'mqtt'
import { deviceTopics } from '../../cli/iot/deviceTopics.js'
import { v4 } from 'uuid'
import * as chai from 'chai'
import { expect } from 'chai'
import chaiSubset from 'chai-subset'
chai.use(chaiSubset)
import fetch from 'node-fetch'
import { createSimulatorKeyAndCSR } from '../../cli/iot/createSimulatorKeyAndCSR.js'

export const deviceStepRunners = ({
	certsDir,
	resourceGroup,
	intermediateCertId,
}: {
	certsDir: string
	resourceGroup: string
	intermediateCertId: string
}): ((step: InterpolatedStep) => StepRunnerFunc<any> | false)[] => {
	const connections = {} as Record<string, MqttClient>
	let fwResult = ''
	return [
		regexGroupMatcher(
			/^I generate a certificate for the (?:device|tracker) "(?<deviceId>[^"]+)"$/,
		)(async ({ deviceId }) => {
			await createSimulatorKeyAndCSR({ certsDir, deviceId })
			await generateDeviceCertificate({
				deviceId,
				certsDir,
				intermediateCertId,
				resourceGroup,
			})

			return deviceId
		}),
		regexGroupMatcher(
			/^I connect the (?:device|tracker) "(?<deviceId>[^"]+)"$/,
		)(async ({ deviceId }) => {
			const connection = await connectDevice({
				deviceId,
				certsDir,
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
				deviceTopics.updateTwinReported(v4()),
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
			/^the (?<desiredOrReported>desired|reported) state of the (?:device|tracker) "(?<deviceId>[^"]+)" (?:should )?(?<equalOrMatch>equals?|match(?:es)?)$/,
		)(async ({ desiredOrReported, deviceId, equalOrMatch }, step) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const j = JSON.parse(step.interpolatedArgument)
			const connection = connections[deviceId]
			const state: Record<string, any> = await new Promise(
				(resolve, reject) => {
					const getTwinPropertiesRequestId = v4()
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
