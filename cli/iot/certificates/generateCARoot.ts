import { promises as fs } from 'fs'
import { CARootFileLocations } from './caFileLocations.js'
import { openssl } from './openssl.js'
import { opensslConfig } from './opensslConfig.js'

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
	debug?: (...message: any[]) => void
	daysValid?: number
}): Promise<void> => {
	const { cert, privateKey } = CARootFileLocations(certsDir)
	try {
		await fs.stat(certsDir)
	} catch {
		await fs.mkdir(certsDir, { recursive: true })
		debug?.(`Created ${certsDir}`)
	}

	let certExists = false
	try {
		await fs.stat(cert)
		certExists = true
	} catch {
		// pass
	}
	if (certExists) {
		throw new Error(`CA Root certificate exists: ${cert}!`)
	}

	// Create the Root CA Cert
	const opensslV3 = openssl({ debug })

	// Create the root CA private key:
	// openssl genrsa -aes256 -passout pass:1234 -out ./private/azure-iot-test-only.root.ca.key.pem 4096
	await opensslV3.command(
		'genrsa',
		'-aes256',
		'-passout',
		'pass:1234',
		'-out',
		privateKey,
		'4096',
	)

	// Create the root CA certificate:
	// openssl req -new -x509 -config ./openssl_root_ca.cnf -passin pass:1234 -key ./private/azure-iot-test-only.root.ca.key.pem -subj '/CN=Azure IoT Hub CA Cert Test Only' -days 30 -sha256 -extensions v3_ca -out ./certs/azure-iot-test-only.root.ca.cert.pem
	await opensslV3.command(
		'req',
		'-new',
		'-x509',
		'-config',
		opensslConfig({
			dir: certsDir,
			certificateFile: cert,
			privateKeyFile: privateKey,
		}),
		'-passin',
		'pass:1234',
		'-key',
		privateKey,
		'-subj',
		`/CN=${name}`,
		'-days',
		`${daysValid ?? 90}`,
		'-sha256',
		'-extensions',
		'v3_ca',
		'-out',
		cert,
	)

	// Examine the root CA certificate:
	debug?.(await opensslV3.command('x509', '-noout', '-text', '-in', cert))

	log('Root CA Certificate', cert)
}
