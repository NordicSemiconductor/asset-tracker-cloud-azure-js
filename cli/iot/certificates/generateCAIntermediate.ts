import { stat, writeFile } from 'fs/promises'
import path from 'path'
import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from './caFileLocations.js'
import { certificateName } from './certificateName.js'
import { openssl } from './openssl.js'
import { opensslConfig } from './opensslConfig.js'

export const defaultIntermediateCAValidityInDays = 365

/**
 * Generates a CA intermediate certificate
 * @see https://github.com/Azure/azure-iot-sdk-node/blob/5a7cd40145575175b4a100bbc84758f8a87c6d37/provisioning/tools/create_test_cert.js
 * @see http://busbyland.com/azure-iot-device-provisioning-service-via-rest-part-1/
 */
export const generateCAIntermediate = async ({
	certsDir,
	log,
	id,
	debug,
	daysValid,
}: {
	certsDir: string
	id: string
	log: (...message: any[]) => void
	debug?: (...message: any[]) => void
	daysValid?: number
}): Promise<{ name: string }> => {
	const { privateKey, cert, csr } = CAIntermediateFileLocations({
		certsDir,
		id,
	})

	const intermediateName = certificateName(`nrfassettracker-intermediate-${id}`)

	// Create the intermediate CA certificate
	const opensslV3 = openssl({ debug })

	// Create the database file (index.txt), and the serial number file (serial)
	try {
		await stat(path.join(certsDir, 'index.txt'))
	} catch {
		await writeFile(path.join(certsDir, 'index.txt'), '')
		await writeFile(
			path.join(certsDir, 'index.txt.attr'),
			'unique_subject = no',
		)
		const serial = await opensslV3.command('rand', '-hex', '16')
		await writeFile(path.join(certsDir, 'serial'), serial)
	}

	// Create the intermediate CA private key:
	// openssl genrsa -aes256 -passout pass:1234 -out ./private/azure-iot-test-only.intermediate.key.pem 4096
	await opensslV3.command(
		'genrsa',
		'-aes256',
		'-passout',
		'pass:1234',
		'-out',
		privateKey,
		'4096',
	)

	// Create the intermediate CA certificate signing request (CSR):
	// openssl req -new -sha256 -passin pass:1234 -config ./openssl_device_intermediate_ca.cnf -subj '/CN=Azure IoT Hub Intermediate Cert Test Only' -key ./private/azure-iot-test-only.intermediate.key.pem -out ./csr/azure-iot-test-only.intermediate.csr.pem
	await opensslV3.command(
		'req',
		'-new',
		'-sha256',
		'-passin',
		'pass:1234',
		'-config',
		opensslConfig({
			dir: certsDir,
			certificateFile: cert,
			privateKeyFile: privateKey,
		}),
		'-subj',
		`/CN=${intermediateName}`,
		'-key',
		privateKey,
		'-out',
		csr,
	)

	// Sign the intermediate certificate with the root CA certificate
	// openssl ca -batch -config ./openssl_root_ca.cnf -passin pass:1234 -extensions v3_intermediate_ca -days 30 -notext -md sha256 -in ./csr/azure-iot-test-only.intermediate.csr.pem -out ./certs/azure-iot-test-only.intermediate.cert.pem
	const caRootFiles = CARootFileLocations(certsDir)
	await opensslV3.command(
		'ca',
		'-batch',
		'-config',
		opensslConfig({
			dir: certsDir,
			certificateFile: caRootFiles.cert,
			privateKeyFile: caRootFiles.privateKey,
		}),
		'-passin',
		'pass:1234',
		'-extensions',
		'v3_intermediate_ca',
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

	// Examine the intermediate CA certificate:
	// openssl x509 -noout -text -in ./certs/azure-iot-test-only.intermediate.cert.pem
	debug?.(await opensslV3.command('x509', '-noout', '-text', '-in', cert))

	log('Intermediate CA Certificate', cert)

	return { name: intermediateName }
}
