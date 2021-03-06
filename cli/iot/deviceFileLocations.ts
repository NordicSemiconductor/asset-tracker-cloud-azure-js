import * as path from 'path'

export const deviceFileLocations = ({
	certsDir,
	deviceId,
}: {
	certsDir: string
	deviceId: string
}): {
	privateKey: string
	cert: string
	certWithChain: string
	registration: string
	intermediateCertId: string
	json: string
} => ({
	privateKey: path.resolve(certsDir, `device-${deviceId}.key`),
	cert: path.resolve(certsDir, `device-${deviceId}.pem`),
	certWithChain: path.resolve(certsDir, `device-${deviceId}.bundle.pem`),
	registration: path.resolve(certsDir, `device-${deviceId}.registration.json`),
	intermediateCertId: path.resolve(
		certsDir,
		`device-${deviceId}.intermediateCertId`,
	),
	json: path.resolve(certsDir, `device-${deviceId}.json`),
})
