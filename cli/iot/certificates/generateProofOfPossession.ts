import { caFileLocations } from './caFileLocations.js'
import { verificationCert } from './verificationCert.js'

/**
 * Verifies the CA possessions
 * @see https://github.com/Azure/azure-iot-sdk-node/blob/5a7cd40145575175b4a100bbc84758f8a87c6d37/provisioning/tools/create_test_cert.js
 * @see http://busbyland.com/azure-iot-device-provisioning-service-via-rest-part-1/
 */
export const generateProofOfPossession = async ({
	caFiles,
	log,
	debug,
	verificationCode,
}: {
	caFiles: ReturnType<typeof caFileLocations>
	verificationCode: string
	log: (...message: any[]) => void
	debug?: (...message: any[]) => void
}): Promise<void> => {
	await verificationCert({
		commonName: verificationCode,
		daysValid: 1,
		outFile: caFiles.verificationCert,
		privateKeyFile: caFiles.verificationPrivateKey,
		csrFile: caFiles.verificationCSR,
		ca: {
			keyFile: caFiles.privateKey,
			certificateFile: caFiles.cert,
		},
		debug,
	})

	log('Verification cert', caFiles.verificationCert, 'for cert', caFiles.cert)
}
