import { writeFile } from 'fs/promises'
import { CAIntermediateFileLocations } from './caFileLocations.js'
import { deviceCertificate } from './deviceCertificate.js'
import { deviceFileLocations } from './deviceFileLocations.js'
import { fingerprint } from './fingerprint.js'

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
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

	debug?.(
		`Intermediate certificate fingerprint`,
		await fingerprint(caIntermediateFiles.cert),
	)

	await deviceCertificate({
		commonName: deviceId,
		daysValid: daysValid ?? defaultDeviceCertificateValidityInDays,
		certificateFile: deviceFiles.cert,
		ca: {
			keyFile: caIntermediateFiles.privateKey,
			certificateFile: caIntermediateFiles.cert,
		},
		csrFile: deviceFiles.csr,
		debug,
	})

	await writeFile(deviceFiles.intermediateCertId, intermediateCertId, 'utf-8')
	debug?.(`${deviceFiles.intermediateCertId} written`)
}
