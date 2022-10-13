import { writeFile } from 'fs/promises'
import { CAIntermediateFileLocations } from './caFileLocations.js'
import { deviceFileLocations } from './deviceFileLocations.js'
import { fingerprint } from './fingerprint.js'
import { openssl } from './openssl.js'
import { opensslConfig } from './opensslConfig.js'

export const defaultDeviceCertificateValidityInDays = 10950

/**
 * Generates a certificate for a device, signed with the CA
 */
export const generateDeviceCertificate = async ({
	certsDir,
	log,
	debug,
	deviceId,
	intermediateCertId,
	daysValid,
}: {
	certsDir: string
	deviceId: string
	intermediateCertId: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
	daysValid?: number
}): Promise<void> => {
	log?.(`Generating certificate for device ${deviceId}`)
	const caIntermediateFiles = CAIntermediateFileLocations({
		certsDir,
		id: intermediateCertId,
	})
	const {
		cert,
		csr,
		intermediateCertId: intermediateCertIdFile,
	} = deviceFileLocations({
		certsDir,
		deviceId,
	})

	debug?.(
		`Intermediate certificate fingerprint`,
		await fingerprint(caIntermediateFiles.cert),
	)

	// Create the device certificates
	const opensslV3 = openssl({ debug })

	// Sign the device certificate.
	// openssl ca -batch -config ./openssl_device_intermediate_ca.cnf -passin pass:1234 -extensions usr_cert -days 30 -notext -md sha256 -in ./csr/device-01.csr.pem -out ./certs/device-01.cert.pem
	await opensslV3.command(
		'ca',
		'-batch',
		'-config',
		opensslConfig({
			dir: certsDir,
			certificateFile: caIntermediateFiles.cert,
			privateKeyFile: caIntermediateFiles.privateKey,
		}),
		'-passin',
		'pass:1234',
		'-extensions',
		'usr_cert',
		'-days',
		`${daysValid ?? 30}`,
		'-notext',
		'-md',
		'sha256',
		'-in',
		csr,
		'-out',
		cert,
	)

	// Examine the device certificate:
	debug?.(await opensslV3.command('x509', '-noout', '-text', '-in', cert))

	await writeFile(intermediateCertIdFile, intermediateCertId, 'utf-8')
	debug?.(`${intermediateCertIdFile} written`)
}
