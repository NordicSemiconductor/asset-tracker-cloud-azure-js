import { randomWords } from '@nordicsemiconductor/random-words'
import { readFile, writeFile } from 'fs/promises'
import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from '../iot/certificates/caFileLocations.js'
import { createSimulatorKeyAndCSR } from '../iot/certificates/createSimulatorKeyAndCSR.js'
import { deviceFileLocations } from '../iot/certificates/deviceFileLocations.js'
import {
	defaultDeviceCertificateValidityInDays,
	generateDeviceCertificate,
} from '../iot/certificates/generateDeviceCertificate.js'
import { list as listIntermediateCerts } from '../iot/intermediateRegistry.js'
import { globalIotHubDPSHostname } from '../iot/ioTHubDPSInfo.js'
import {
	debug as debugFn,
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
	idScope: idScopePromise,
}: {
	certsDir: () => Promise<string>
	/**
	 * Promise that returns the idScope
	 */
	idScope: () => Promise<string>
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
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({
		deviceId,
		intermediateCertId,
		expires,
		debug,
	}: {
		deviceId?: string
		intermediateCertId?: string
		expires?: string
		debug?: boolean
	}) => {
		const id = deviceId ?? (await randomWords({ numWords: 3 })).join('-')

		const certsDir = await certsDirPromise()

		if (intermediateCertId === undefined) {
			const intermediateCerts = await listIntermediateCerts({ certsDir })
			intermediateCertId = intermediateCerts[0]
		}

		const rootCAFiles = CARootFileLocations(certsDir)
		await readFile(rootCAFiles.cert)

		const intermediateCAFiles = CAIntermediateFileLocations({
			certsDir,
			id: intermediateCertId,
		})

		await readFile(intermediateCAFiles.cert, 'utf-8')
		setting('Intermediate certificate', intermediateCertId)

		await createSimulatorKeyAndCSR({
			deviceId: id,
			certsDir,
			log,
			debug: debug === true ? debugFn : undefined,
			intermediateCertId,
		})

		await generateDeviceCertificate({
			deviceId: id,
			certsDir,
			log,
			debug: debug === true ? debugFn : undefined,
			intermediateCertId,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`Certificate for device generated.`)
		setting('Certificate ID', id)

		const {
			json: certJSON,
			privateKey,
			cert,
		} = deviceFileLocations({
			certsDir,
			deviceId: id,
		})

		const idScope = await idScopePromise()

		await writeFile(
			certJSON,
			JSON.stringify(
				{
					clientId: id,
					idScope,
					privateKey: await readFile(privateKey, 'utf-8'),
					certificate: await readFile(cert, 'utf-8'),
					intermediateCA: await readFile(intermediateCAFiles.cert, 'utf-8'),
					rootCA: await readFile(rootCAFiles.cert, 'utf-8'),
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

		heading('Firmware configuration')
		setting('DPS hostname', globalIotHubDPSHostname)
		setting('ID scope', idScope)
		setting('Client ID', id)
	},
	help: 'Generate a certificate for a simulated device and register a device in the registry.',
})
