import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { randomWords } from '@nordicsemiconductor/random-words'
import { readFile, writeFile } from 'fs/promises'
import { createSimulatorKeyAndCSR } from '../iot/createSimulatorKeyAndCSR.js'
import { deviceFileLocations } from '../iot/deviceFileLocations.js'
import {
	defaultDeviceCertificateValidityInDays,
	generateDeviceCertificate,
} from '../iot/generateDeviceCertificate.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import {
	debug,
	heading,
	log,
	newline,
	next,
	setting,
	success,
} from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

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
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`Certificate for device generated.`)
		setting('Certificate ID', id)

		const {
			json: certJSON,
			privateKey,
			certWithChain,
		} = deviceFileLocations({ certsDir, deviceId: id })

		await writeFile(
			certJSON,
			JSON.stringify(
				{
					resourceGroup,
					privateKey: await readFile(privateKey, 'utf-8'),
					clientCert: await readFile(certWithChain, 'utf-8'),
					clientId: deviceId,
				},
				null,
				2,
			),
			'utf-8',
		)
		success(`${certJSON} written`)
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
