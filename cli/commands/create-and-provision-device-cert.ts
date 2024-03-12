import {
	atHostHexfile,
	connect,
	createPrivateKeyAndCSR,
	flashCertificate,
	getIMEI,
} from '@nordicsemiconductor/device-helpers'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { CAIntermediateFileLocations } from '../iot/certificates/caFileLocations.js'
import { deviceFileLocations } from '../iot/certificates/deviceFileLocations.js'
import {
	defaultDeviceCertificateValidityInDays,
	generateDeviceCertificate,
} from '../iot/certificates/generateDeviceCertificate.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import {
	debug as dbg,
	heading,
	log,
	progress,
	setting,
	success,
} from '../logging.js'
import { run } from '../process/run.js'
import { CommandDefinition } from './CommandDefinition.js'

export const defaultPort = '/dev/ttyACM0'
export const defaultSecTag = 11

export const createAndProvisionDeviceCertCommand = ({
	certsDir: certsDirPromise,
	idScope: idScopePromise,
}: {
	certsDir: () => Promise<string>
	/**
	 * Promise that returns the idScope
	 */
	idScope: () => Promise<string>
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
	}) => {
		const logFn = debug === true ? log : undefined
		const debugFn = debug === true ? dbg : undefined

		progress('Flashing certificate', port ?? defaultPort)
		const connection = (
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

		const idScope = await idScopePromise()

		heading('Firmware configuration')
		setting('DPS hostname', globalIotHubDPSHostname)
		setting('ID scope', idScope)

		heading('Provisioning certificate')

		const { cert } = deviceFileLocations({
			certsDir,
			deviceId,
		})
		const caIntermediateFiles = CAIntermediateFileLocations({
			certsDir,
			id: intermediateCertId,
		})

		const intermediateCert = await readFile(caIntermediateFiles.cert, 'utf-8')

		const [
			// Keep the Baltimore CyberTrust Root in your devices' trusted root store.
			BaltimoreCyberTrustRoot,
			// Add the DigiCert Global Root G2
			DigiCertGlobalRootG2,
			// and the Microsoft RSA Root Certificate Authority 2017 certificates
			MicrosoftRSARootCertificateAuthority2017,
		] = await Promise.all([
			readFile(
				path.resolve(process.cwd(), 'data', 'BaltimoreCyberTrustRoot.pem'),
				'utf-8',
			),
			readFile(
				path.resolve(process.cwd(), 'data', 'DigiCertGlobalRootG2.pem'),
				'utf-8',
			),
			readFile(
				path.resolve(
					process.cwd(),
					'data',
					'MicrosoftRSARootCertificateAuthority2017.pem',
				),
				'utf-8',
			),
		])
		await flashCertificate({
			at: connection.at,
			secTag: effectiveSecTag,
			clientCert: [await readFile(cert, 'utf-8'), intermediateCert].join(
				os.EOL,
			),
			caCert: [
				BaltimoreCyberTrustRoot,
				DigiCertGlobalRootG2,
				MicrosoftRSARootCertificateAuthority2017,
			].join(os.EOL),
		})
		success('Certificate written to device')

		heading('Closing connection')
		await connection.end()
	},
	help: 'Generate a certificate for the connected device using device-generated keys, signed with the CA, and flash it to the device.',
})
