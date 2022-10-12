import { caCertConfig, openssl } from './openssl.js'

export const intermediateCA = async ({
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
		'-sha256',
		'-config',
		await caCertConfig(commonName),
		'-key',
		privateKeyFile,
		'-passin',
		'pass:1234',
		'-CA',
		ca.certificateFile,
		'-CAkey',
		ca.keyFile,
		'-out',
		csrFile,
	)

	// Cert
	await opensslV3.command(
		'ca',
		'-batch',
		'-config',
		await caCertConfig(commonName),
		'-extensions',
		'v3_req',
		'-passin',
		'pass:1234',
		'-key',
		privateKeyFile,
		'-days',
		`${daysValid ?? 90}`,
		'-notext',
		'-md',
		'sha256',
		'-in',
		csrFile,
		'-out',
		outFile,
	)
}
