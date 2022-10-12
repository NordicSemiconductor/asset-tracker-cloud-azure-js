import { caCertConfig, openssl } from './openssl.js'

export const rootCA = async ({
	commonName,
	privateKeyFile,
	outFile,
	daysValid,
	debug,
}: {
	commonName: string
	privateKeyFile: string
	outFile: string
	daysValid?: number
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

	// Self-signed certificate
	await opensslV3.command(
		'req',
		'-new',
		'-x509',
		'-config',
		await caCertConfig(commonName),
		'-key',
		privateKeyFile,
		'-passin',
		'pass:1234',
		'-days',
		`${daysValid ?? 90}`,
		'-sha256',
		'-extensions',
		'v3_req',
		'-out',
		outFile,
	)
}
