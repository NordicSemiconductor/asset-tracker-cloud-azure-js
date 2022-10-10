import { promises as fs } from 'fs'
import { CARootFileLocations } from './caFileLocations.js'
import { rootCA } from './certificates/rootCA.js'

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
	const caFiles = CARootFileLocations(certsDir)
	try {
		await fs.stat(certsDir)
	} catch {
		await fs.mkdir(certsDir, { recursive: true })
		debug?.(`Created ${certsDir}`)
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
	await rootCA({
		commonName: name,
		daysValid: daysValid ?? defaultCAValidityInDays,
		outFile: caFiles.cert,
		privateKeyFile: caFiles.privateKey,
		csrFile: caFiles.csr,
		debug
	})

	log('Root CA Certificate', caFiles.cert)
}
