import { promises as fs } from 'fs'
import { CertificateCreationResult, createCertificate } from 'pem'
import { CARootFileLocations } from './caFileLocations.js'
import { caCertConfig } from './pemConfig.js'

export const defaultCAValidityInDays = 365

/**
 * Generates a CA Root certificate
 *
 * @see https://github.com/Azure/azure-iot-sdk-node/blob/5a7cd40145575175b4a100bbc84758f8a87c6d37/provisioning/tools/create_test_cert.js
 * @see http://busbyland.com/azure-iot-device-provisioning-service-via-rest-part-1/
 */
export const generateCARoot = async ({
	certsDir,
	name,
	log,
	debug,
	daysValid,
}: {
	certsDir: string
	name: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
	daysValid?: number
}): Promise<CertificateCreationResult> => {
	const caFiles = CARootFileLocations(certsDir)
	try {
		await fs.stat(certsDir)
	} catch {
		await fs.mkdir(certsDir, { recursive: true })
		debug(`Created ${certsDir}`)
	}

	let certExists = false
	try {
		await fs.stat(caFiles.cert)
		certExists = true
	} catch {
		// pass
	}
	if (certExists) {
		throw new Error(`CA Root certificate exists: ${caFiles.cert}!`)
	}

	// Create the Root CA Cert

	const rootCert = await new Promise<CertificateCreationResult>(
		(resolve, reject) =>
			createCertificate(
				{
					commonName: name,
					serial: Math.floor(Math.random() * 1000000000),
					days: daysValid ?? defaultCAValidityInDays,
					selfSigned: true,
					config: caCertConfig(name),
				},
				(err, cert) => {
					if (err !== null && err !== undefined) return reject(err)
					resolve(cert)
				},
			),
	)

	await Promise.all([
		fs.writeFile(caFiles.cert, rootCert.certificate, 'utf-8'),
		fs.writeFile(caFiles.privateKey, rootCert.clientKey, 'utf-8'),
		fs.writeFile(caFiles.name, name, 'utf-8'),
	])

	log('Root CA Certificate', caFiles.cert)
	debug(rootCert.certificate)

	return rootCert
}
