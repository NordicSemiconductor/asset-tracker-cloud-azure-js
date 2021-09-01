import { CommandDefinition } from './CommandDefinition.js'
import { randomWords } from '@nordicsemiconductor/random-words'
import {
	generateDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../iot/generateDeviceCertificate.js'
import { log, debug, success, newline, next } from '../logging.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { deviceFileLocations } from '../iot/deviceFileLocations.js'
import { setting, heading } from '../logging.js'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import { createSimulatorKeyAndCSR } from '../iot/createSimulatorKeyAndCSR.js'

export const createSimulatorCertCommand = ({
	certsDir: certsDirPromise,
	resourceGroup,
	iotDpsClient,
	dpsName,
}: {
	certsDir: () => Promise<string>
	iotDpsClient: () => Promise<IotDpsClient>
	resourceGroup: string
	dpsName: string
}): CommandDefinition => ({
	command: 'create-simulator-cert',
	options: [
		{
			flags: '-d, --deviceId <deviceId>',
			description: 'Device ID, if left blank a random ID will be generated',
		},
		{
			flags: '-i, --intermediateCertId <intermediateCertId>',
			description:
				'ID of the CA intermediate certificate to use, if left blank the first will be used',
		},
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultDeviceCertificateValidityInDays} days.`,
		},
	],
	action: async ({
		deviceId,
		intermediateCertId,
		expires,
	}: {
		deviceId?: string
		intermediateCertId?: string
		expires?: string
	}) => {
		const id = deviceId ?? (await randomWords({ numWords: 3 })).join('-')

		const certsDir = await certsDirPromise()

		if (intermediateCertId === undefined) {
			const intermediateCerts = await listIntermediateCerts({ certsDir })
			intermediateCertId = intermediateCerts[0]
		}

		setting('Intermediate certificate', intermediateCertId)

		await createSimulatorKeyAndCSR({
			deviceId: id,
			certsDir,
			log,
			debug,
		})

		await generateDeviceCertificate({
			deviceId: id,
			certsDir,
			log,
			debug,
			intermediateCertId,
			resourceGroup,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`Certificate for device generated.`)
		setting('Certificate ID', id)

		const certJSON = deviceFileLocations({ certsDir, deviceId: id }).json
		newline()
		next(
			'You can now connect to the broker using',
			`npm exec -- @nordicsemiconductor/asset-tracker-cloud-device-simulator-azure ${certJSON}`,
		)

		const { properties } = await (
			await iotDpsClient()
		).iotDpsResource.get(dpsName, resourceGroup)

		heading('Firmware configuration')
		setting('DPS hostname', globalIotHubDPSHostname)
		setting('ID scope', properties.idScope as string)
	},
	help: 'Generate a certificate for a simulated device and register a device in the registry.',
})
