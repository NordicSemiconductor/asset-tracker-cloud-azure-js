import { promises as fs } from 'fs'
import { writeFile } from 'fs/promises'
import * as os from 'os'
import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from './caFileLocations.js'
import { deviceCertificate } from './certificates/deviceCertificate.js'
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
	const caRootFiles = CARootFileLocations(certsDir)
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
		signkeyFile: caIntermediateFiles.privateKey,
		csrFile: deviceFiles.csr,
	})

	const [certificate, intermediateCert, rootCert] = await Promise.all([
		fs.readFile(deviceFiles.cert, 'utf-8'),
		fs.readFile(caIntermediateFiles.cert, 'utf-8'),
		fs.readFile(caRootFiles.cert, 'utf-8'),
	])

	await writeFile(
		deviceFiles.caCertificateChain,
		[intermediateCert, rootCert].join(os.EOL),
		'utf-8',
	)
	debug?.(`${deviceFiles.caCertificateChain} written`)

	await writeFile(
		deviceFiles.certWithChain,
		[certificate, intermediateCert, rootCert].join(os.EOL),
		'utf-8',
	)
	debug?.(`${deviceFiles.certWithChain} written`)

	await writeFile(deviceFiles.intermediateCertId, intermediateCertId, 'utf-8')
	debug?.(`${deviceFiles.intermediateCertId} written`)
}
