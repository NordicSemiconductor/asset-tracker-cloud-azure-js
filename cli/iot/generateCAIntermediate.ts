import { promises as fs } from 'fs'
import { CertificateCreationResult, createCertificate } from 'pem'
import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from './caFileLocations.js'
import { certificateName } from './certificateName.js'
import { caCertConfig } from './pemConfig.js'

export const defaultIntermediateCAValidityInDays = 365

/**
 * Generates a CA intermediate certificate
 * @see https://github.com/Azure/azure-iot-sdk-node/blob/5a7cd40145575175b4a100bbc84758f8a87c6d37/provisioning/tools/create_test_cert.js
 * @see http://busbyland.com/azure-iot-device-provisioning-service-via-rest-part-1/
 */
export const generateCAIntermediate = async (args: {
	certsDir: string
	id: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
	daysValid?: number
}): Promise<CertificateCreationResult> => {
	const { certsDir, log, debug, id } = args
	const caRootFiles = CARootFileLocations(certsDir)

	// Create the intermediate CA cert (signed by the root)

	const caIntermediateFiles = CAIntermediateFileLocations({
		certsDir,
		id,
	})

	const [rootPrivateKey, rootCert] = await Promise.all([
		fs.readFile(caRootFiles.privateKey, 'utf-8'),
		fs.readFile(caRootFiles.cert, 'utf-8'),
	])

	const intermediateName = certificateName(
		`Asset Tracker Intermediate CA ${id}`,
	)

	const intermediateCert = await new Promise<CertificateCreationResult>(
		(resolve, reject) =>
			createCertificate(
				{
					commonName: intermediateName,
					serial: Math.floor(Math.random() * 1000000000),
					days: args.daysValid ?? defaultIntermediateCAValidityInDays,
					config: caCertConfig(intermediateName),
					serviceKey: rootPrivateKey,
					serviceCertificate: rootCert,
				},
				(err, cert) => {
					if (err !== null && err !== undefined) return reject(err)
					resolve(cert)
				},
			),
	)

	log('Intermediate CA Certificate', caIntermediateFiles.cert)
	debug(intermediateCert.certificate)

	await fs.writeFile(caIntermediateFiles.cert, intermediateCert.certificate)
	await fs.writeFile(caIntermediateFiles.privateKey, intermediateCert.clientKey)

	return intermediateCert
}
