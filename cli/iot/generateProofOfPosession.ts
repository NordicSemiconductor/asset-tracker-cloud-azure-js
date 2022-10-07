import {
	CARootFileLocations,
	CARootVerificationFileLocations,
} from './caFileLocations.js'
import { intermediateCA } from './certificates/intermediateCA.js'

/**
 * Verifies the CA posessions
 * @see https://github.com/Azure/azure-iot-sdk-node/blob/5a7cd40145575175b4a100bbc84758f8a87c6d37/provisioning/tools/create_test_cert.js
 * @see http://busbyland.com/azure-iot-device-provisioning-service-via-rest-part-1/
 */
export const generateProofOfPosession = async (args: {
	certsDir: string
	verificationCode: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
}): Promise<void> => {
	const { certsDir, log, verificationCode } = args
	const caRootFiles = CARootFileLocations(certsDir)
	const caRootVerificationFiles = CARootVerificationFileLocations(certsDir)

	await intermediateCA({
		commonName: verificationCode,
		daysValid: 1,
		signkeyFile: caRootFiles.privateKey,
		outFile: caRootVerificationFiles.verificationCert,
		privateKeyFile: caRootVerificationFiles.verificationKey,
		csrFile: caRootVerificationFiles.verificationCSR,
	})

	log('Verification cert', caRootVerificationFiles.verificationCert)
}
