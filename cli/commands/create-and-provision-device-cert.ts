import { CommandDefinition } from './CommandDefinition.js'
import {
	generateDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../iot/generateDeviceCertificate.js'
import { log, success, progress } from '../logging.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { setting, heading } from '../logging.js'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import {
	atHostHexfile,
	connect,
	createPrivateKeyAndCSR,
	getIMEI,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { run } from '../process/run.js'
import { deviceFileLocations } from '../iot/deviceFileLocations.js'

export const defaultPort = '/dev/ttyACM0'
export const defaultSecTag = 42

export const createAndProvisionDeviceCertCommand = ({
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
	command: 'create-and-provision-device-cert',
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultDeviceCertificateValidityInDays} days.`,
		},
		{
			flags: '-p, --port <port>',
			description: `The port the device is connected to, defaults to ${defaultPort}`,
		},
		{
			flags: '--dk',
			description: `Connected device is a 9160 DK`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Use this secTag, defaults to ${defaultSecTag}`,
		},
		{
			flags: '-a, --at-host <atHost>',
			description: `Flash at_host from this file`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
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
		port,
		atHost,
		dk,
		debug,
		intermediateCertId,
		expires,
		secTag,
	}) => {
		progress('Flasing certificate', port ?? defaultPort)

		const connection = await connect({
			atHostHexfile:
				atHost ??
				(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
			device: port ?? defaultPort,
			warn: console.error,
			debug: debug === true ? console.debug : undefined,
			progress: debug === true ? console.log : undefined,
			inactivityTimeoutInSeconds: 10,
		})

		const deviceId = await getIMEI({ at: connection.connection.at })

		setting('IMEI', deviceId)

		const csr = await createPrivateKeyAndCSR({
			at: connection.connection.at,
			secTag: secTag ?? defaultSecTag,
		})

		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep))
		const deviceCSRDERLocation = path.join(tempDir, `${deviceId}-csr.der`)

		await fs.writeFile(deviceCSRDERLocation, csr)

		const certsDir = await certsDirPromise()

		// Convert to PEM
		const deviceFiles = deviceFileLocations({
			certsDir,
			deviceId,
		})
		await run({
			command: 'openssl',
			args: [
				'req',
				'-inform',
				'DER',
				'-in',
				deviceCSRDERLocation,
				'-out',
				deviceFiles.csr,
			],
		})

		if (intermediateCertId === undefined) {
			const intermediateCerts = await listIntermediateCerts({ certsDir })
			intermediateCertId = intermediateCerts[0]
		}

		setting('Intermediate certificate', intermediateCertId)

		await generateDeviceCertificate({
			deviceId,
			certsDir,
			log,
			debug,
			intermediateCertId,
			resourceGroup,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`Certificate for device generated.`)
		setting('Certificate ID', deviceId)

		const { properties } = await (
			await iotDpsClient()
		).iotDpsResource.get(dpsName, resourceGroup)

		heading('Firmware configuration')
		setting('DPS hostname', globalIotHubDPSHostname)
		setting('ID scope', properties.idScope as string)
	},
	help: 'Generate a certificate for the connected device using device-generated keys, signed with the CA, and flash it to the device.',
})