import { openssl, verificationCertConfig } from './openssl.js'

export const verificationCert = async ({
	commonName,
	privateKeyFile,
	outFile: outFile,
	csrFile,
	daysValid,
	ca,
	debug,
}: {
	commonName: string
	privateKeyFile: string
	outFile: string
	csrFile: string
	daysValid?: number
	ca: {
		keyFile: string
		certificateFile: string
	}
	debug?: (...message: any[]) => void
}) => {
	const opensslV3 = openssl({ debug })

	// Key
	await opensslV3.command(
		'genrsa',
		'-aes256',
		'-out',
		privateKeyFile,
		'-passout',
		'pass:1234',
		'4096',
	)

	// CSR
	await opensslV3.command(
		'req',
		'-new',
		'-config',
		await verificationCertConfig(commonName),
		'-key',
		privateKeyFile,
		'-passin',
		'pass:1234',
		'-out',
		csrFile,
	)

	// Cert
	await opensslV3.command(
		'x509',
		'-req',
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
		'-CA',
		ca.certificateFile,
		'-CAkey',
		ca.keyFile,
		'-passin',
		'pass:1234',
		'-out',
		outFile,
	)
}
