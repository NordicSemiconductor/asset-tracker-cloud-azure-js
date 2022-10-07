import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from './caFileLocations.js'
import { certificateName } from './certificateName.js'
import { intermediateCA } from './certificates/intermediateCA.js'

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
}): Promise<void> => {
	const { certsDir, log, id } = args
	const caRootFiles = CARootFileLocations(certsDir)

	// Create the intermediate CA cert (signed by the root)

	const caIntermediateFiles = CAIntermediateFileLocations({
		certsDir,
		id,
	})

	const intermediateName = certificateName(
		`Asset Tracker Intermediate CA ${id}`,
	)

	await intermediateCA({
		commonName: intermediateName,
		daysValid: args.daysValid ?? defaultIntermediateCAValidityInDays,
		signkeyFile: caRootFiles.privateKey,
		signCertificateFile: caRootFiles.cert,
		outFile: caIntermediateFiles.cert,
		privateKeyFile: caIntermediateFiles.privateKey,
		csrFile: caIntermediateFiles.csr,
	})

	log('Intermediate CA Certificate', caIntermediateFiles.cert)
}
