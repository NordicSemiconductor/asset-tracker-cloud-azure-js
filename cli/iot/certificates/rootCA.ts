import { caCertConfig, openssl } from './openssl.js'

export const rootCA = async ({
	commonName,
	privateKeyFile,
	outFile,
	csrFile,
	daysValid,
	debug,
}: {
	commonName: string
	privateKeyFile: string
	outFile: string
	csrFile: string
	daysValid?: number
	debug?: (...message: any[]) => void
}) => {
	const opensslV3 = openssl({ debug })

	// Key
	await opensslV3.createKey(privateKeyFile)

	// CSR
	await opensslV3.command(
		'req',
		'-new',
		'-config',
		await caCertConfig(commonName),
		'-key',
		privateKeyFile,
		'-out',
		csrFile,
	)

	// Self-signed certificate
	await opensslV3.command(
		'x509',
		'-req',
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
		'-signkey',
		privateKeyFile,
		'-out',
		outFile,
	)
}
