import { createKey, openssl } from './certificates/openssl.js'
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
}): Promise<{ deviceId: string }> => {
	log?.(`Generating certificate for device ${deviceId}`)
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

	await createKey(deviceFiles.privateKey)

	debug?.(`${deviceFiles.privateKey} written`)

	await openssl(
		'req',
		'-new',
		'-key',
		deviceFiles.privateKey,
		'-out',
		deviceFiles.csr,
	)

	debug?.(deviceFiles.csr)

	return { deviceId }
}
