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
	registration: string
	intermediateCertId: string
	json: string
	csr: string
} => ({
	privateKey: path.resolve(certsDir, `device-${deviceId}.pem.key`),
	cert: path.resolve(certsDir, `device-${deviceId}.pem.crt`),
	registration: path.resolve(certsDir, `device-${deviceId}.registration.json`),
	intermediateCertId: path.resolve(
		certsDir,
		`device-${deviceId}.intermediateCertId`,
	),
	json: path.resolve(certsDir, `device-${deviceId}.json`),
	csr: path.resolve(certsDir, `device-${deviceId}.pem.csr`),
})

export type DeviceCertificateJSON = {
	clientId: string
	idScope: string
	privateKey: string
	certificate: string
	intermediateCA: string
	rootCA: string
}
