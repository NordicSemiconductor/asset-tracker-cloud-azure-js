import { leafCertConfig, openssl } from './openssl.js'

export const deviceCertificate = async ({
	commonName,
	certificateFile,
	csrFile,
	daysValid,
	ca,
	debug,
}: {
	commonName: string
	certificateFile: string
	csrFile: string
	daysValid?: number
	ca: {
		keyFile: string
		certificateFile: string
	}
	debug?: (...message: any[]) => void
}) => {
	await openssl({ debug }).command(
		'x509',
		'-req',
		'-sha256',
		'-extensions',
		'v3_req',
		'-extfile',
		await leafCertConfig(commonName),
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
		'-CA',
		ca.certificateFile,
		'-CAkey',
		ca.keyFile,
		'-out',
		certificateFile,
	)
}
