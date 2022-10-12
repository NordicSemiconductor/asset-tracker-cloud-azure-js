import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { readFile } from 'fs/promises'
import { TextEncoder } from 'util'
import { log, setting, success } from '../../logging.js'
import { caFileLocations } from './caFileLocations'
import { fingerprint } from './fingerprint'
import { generateProofOfPossession } from './generateProofOfPossession.js'

/**
 * Register a certificate with the Azure IoT Device Provisioning Service
 */
export const registerCertificate = async (
	certificateName: string,
	caFiles: ReturnType<typeof caFileLocations>,
	iotDpsClient: () => Promise<IotDpsClient>,
	resourceGroup: string,
	dpsName: string,
	debug?: (...message: any[]) => void,
) => {
	setting('Fingerprint', await fingerprint(caFiles.cert))

	// Register root CA certificate on DPS
	const armDpsClient = await iotDpsClient()

	await armDpsClient.dpsCertificate.createOrUpdate(
		resourceGroup,
		dpsName,
		certificateName,
		{
			properties: {
				certificate: new TextEncoder().encode(
					await readFile(caFiles.cert, 'utf-8'),
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
		caFiles,
		log,
		verificationCode: properties.verificationCode,
		debug,
	})

	success(`Generated verification certificate for verification code`)
	setting('Verification Code', properties.verificationCode)

	// Proof possession
	const verificationCert = await readFile(caFiles.verificationCert, 'utf-8')

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
