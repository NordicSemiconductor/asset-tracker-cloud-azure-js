import { CAIntermediateFileLocations } from './caFileLocations.js'
import { deviceFileLocations } from './deviceFileLocations.js'
import { initDb, openssl } from './openssl.js'
import { opensslConfig } from './opensslConfig.js'

/**
 * Creates a private key and a CSR for a simulated device
 */
export const createSimulatorKeyAndCSR = async ({
	certsDir,
	log,
	debug,
	deviceId,
	intermediateCertId,
}: {
	certsDir: string
	deviceId: string
	intermediateCertId: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
}): Promise<void> => {
	log?.(`Generating key and CSR for device ${deviceId}`)
	const caIntermediateFiles = CAIntermediateFileLocations({
		certsDir,
		id: intermediateCertId,
	})
	const { privateKey, csr } = deviceFileLocations({
		certsDir,
		deviceId,
	})
	// Create the device certificates
	const opensslV3 = openssl({ debug })

	// Create the database file (index.txt), and the serial number file (serial)
	await initDb({ debug, certsDir })

	// Create the first device private key.
	// openssl genrsa -out ./private/device-01.key.pem 4096
	await opensslV3.command(
		'ecparam',
		'-out',
		privateKey,
		'-name',
		'prime256v1',
		'-genkey',
	)

	// Create the device certificate CSR.
	// openssl req -config ./openssl_device_intermediate_ca.cnf -key ./private/device-01.key.pem -subj '/CN=device-01' -new -sha256 -out ./csr/device-01.csr.pem
	await opensslV3.command(
		'req',
		'-config',
		opensslConfig({
			dir: certsDir,
			certificateFile: caIntermediateFiles.cert,
			privateKeyFile: caIntermediateFiles.privateKey,
		}),
		'-key',
		privateKey,
		'-subj',
		`/CN=${deviceId}`,
		'-new',
		'-sha256',
		'-out',
		csr,
	)
}
