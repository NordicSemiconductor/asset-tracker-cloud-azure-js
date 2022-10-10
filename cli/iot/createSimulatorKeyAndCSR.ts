import { leafCertConfig, openssl } from './certificates/openssl.js'
import { deviceFileLocations } from './deviceFileLocations.js'

export const defaultDeviceCertificateValidityInDays = 10950

/**
 * Creates a private key and a CSR for a simulated device
 */
export const createSimulatorKeyAndCSR = async ({
	certsDir,
	log,
	debug,
	deviceId,
}: {
	certsDir: string
	deviceId: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
}): Promise<void> => {
	log?.(`Generating key and CSR for device ${deviceId}`)
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})
	const opensslV3 = openssl({ debug })

	await opensslV3.createKey(deviceFiles.privateKey)

	await opensslV3.command(
		'req',
		'-new',
		'-config',
		await leafCertConfig(deviceId),
		'-key',
		deviceFiles.privateKey,
		'-out',
		deviceFiles.csr,
	)
}
