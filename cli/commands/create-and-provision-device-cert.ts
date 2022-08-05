import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import {
	atHostHexfile,
	connect,
	Connection,
	createPrivateKeyAndCSR,
	flashCertificate,
	getIMEI,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import chalk from 'chalk'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { deviceFileLocations } from '../iot/deviceFileLocations.js'
import {
	defaultDeviceCertificateValidityInDays,
	generateDeviceCertificate,
} from '../iot/generateDeviceCertificate.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import { readlineDevice } from '../iot/readlineDevice.js'
import { heading, progress, setting, success } from '../logging.js'
import { run } from '../process/run.js'
import { CommandDefinition } from './CommandDefinition.js'

export const defaultPort = '/dev/ttyACM0'
export const defaultSecTag = 11

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
			flags: '-X, --delete-private-key',
			description: `Delete the private key (needed if a private key exists with the secTag)`,
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
		{
			flags: '-S, --simulated-device',
			description: `Use a simulated (soft) device. Useful if you do not have physical access to the device. Will print the AT commands sent to the device allows to provide responses on the command line.`,
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
		deletePrivateKey,
		simulatedDevice,
	}) => {
		const logFn = debug === true ? console.log : undefined
		const debugFn = debug === true ? console.debug : undefined

		let connection: Connection

		if (simulatedDevice === true) {
			console.log(
				chalk.magenta(`Flashing certificate`),
				chalk.blue('(simulated device)'),
			)
			connection = await readlineDevice()
		} else {
			progress('Flashing certificate', port ?? defaultPort)
			connection = (
				await connect({
					atHostHexfile:
						atHost ??
						(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
					device: port ?? defaultPort,
					warn: console.error,
					debug: debugFn,
					progress: logFn,
					inactivityTimeoutInSeconds: 60,
				})
			).connection
		}

		const deviceId = await getIMEI({ at: connection.at })
		setting('IMEI', deviceId)

		const effectiveSecTag = secTag ?? defaultSecTag
		const csr = await createPrivateKeyAndCSR({
			at: connection.at,
			secTag: effectiveSecTag,
			deletePrivateKey: deletePrivateKey ?? false,
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
			log: logFn,
			debug: debugFn,
			intermediateCertId,
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

		heading('Provisioning certificate')
		const { cert, caCertificateChain } = deviceFileLocations({
			certsDir,
			deviceId,
		})
		await flashCertificate({
			at: connection.at,
			caCert: await readFile(
				path.resolve(process.cwd(), 'data', 'BaltimoreCyberTrustRoot.pem'),
				'utf-8',
			),
			secTag: effectiveSecTag,
			clientCert: [
				await readFile(caCertificateChain, 'utf-8'),
				await readFile(cert, 'utf-8'),
			].join('\n'),
		})
		success('Certificate written to device')

		heading('Closing connection')
		await connection.end()
	},
	help: 'Generate a certificate for the connected device using device-generated keys, signed with the CA, and flash it to the device.',
})
