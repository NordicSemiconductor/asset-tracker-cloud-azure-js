import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { readFile, writeFile } from 'fs/promises'
import { TextEncoder } from 'util'
import { v4 } from 'uuid'
import {
	CARootFileLocations,
	CARootVerificationFileLocations,
} from '../iot/caFileLocations.js'
import { certificateName as cn } from '../iot/certificateName.js'
import { fingerprint } from '../iot/fingerprint.js'
import {
	defaultCAValidityInDays,
	generateCARoot,
} from '../iot/generateCARoot.js'
import { generateProofOfPossession } from '../iot/generateProofOfPossession.js'
import {
	debug as debugFN,
	log,
	newline,
	next,
	setting,
	success,
} from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

export const createCARootCommand = ({
	certsDir: certsDirPromise,
	iotDpsClient,
	resourceGroup,
	dpsName,
}: {
	certsDir: () => Promise<string>
	resourceGroup: string
	dpsName: string
	iotDpsClient: () => Promise<IotDpsClient>
}): CommandDefinition => ({
	command: 'create-ca-root',
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultCAValidityInDays} days.`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({ expires, debug }: { expires?: string; debug?: boolean }) => {
		const certificateName = cn(`nrfassettracker-root-${v4()}`)

		const certsDir = await certsDirPromise()

		await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug: debug ? debugFN : undefined,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`CA root certificate generated.`)

		const caFiles = CARootFileLocations(certsDir)
		await writeFile(caFiles.name, certificateName, 'utf-8')

		await registerCertificate(
			caFiles.cert,
			iotDpsClient,
			resourceGroup,
			dpsName,
			certificateName,
			certsDir,
		)

		newline()
		next(
			'You can now create a CA intermediate certificate using',
			'./cli.sh create-ca-intermediate',
		)
	},
	help: 'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})

/**
 * Register a certificate with the Azure IoT Device Provisioning Service
 */
const registerCertificate = async (
	certFile: string,
	iotDpsClient: () => Promise<IotDpsClient>,
	resourceGroup: string,
	dpsName: string,
	certificateName: string,
	certsDir: string,
) => {
	setting('Fingerprint', await fingerprint(certFile))

	// Register root CA certificate on DPS
	const armDpsClient = await iotDpsClient()

	await armDpsClient.dpsCertificate.createOrUpdate(
		resourceGroup,
		dpsName,
		certificateName,
		{
			properties: {
				certificate: new TextEncoder().encode(
					await readFile(certFile, 'utf-8'),
				),
			},
		},
	)

	success(`CA registered with DPS`)
	setting('DPS name', dpsName)

	// Create verification cert
	const { etag } = await armDpsClient.dpsCertificate.get(
		certificateName,
		resourceGroup,
		dpsName,
	)
	setting('Etag', etag as string)

	const { properties, etag: etag2 } =
		await armDpsClient.dpsCertificate.generateVerificationCode(
			certificateName,
			etag as string,
			resourceGroup,
			dpsName,
		)

	if (properties?.verificationCode === undefined) {
		throw new Error(`Failed to generate verification code`)
	}
	setting('verificationCode', properties.verificationCode)

	await generateProofOfPossession({
		certsDir,
		log,
		debug: debugFN,
		verificationCode: properties.verificationCode,
	})

	success(`Generated verification certificate for verification code`)
	setting('Verification Code', properties.verificationCode)

	// Proof possession
	const caRootVerificationLocations = CARootVerificationFileLocations(certsDir)

	const verificationCert = await readFile(
		caRootVerificationLocations.verificationCert,
		'utf-8',
	)

	setting('Certificate', certificateName)

	await armDpsClient.dpsCertificate.verifyCertificate(
		certificateName,
		etag2 as string,
		resourceGroup,
		dpsName,
		{
			certificate: verificationCert,
		},
	)

	success('Verified CA certificate.')
}
