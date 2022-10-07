import { caCertConfig, checkVersion, createKey, openssl } from './openssl.js'

export const rootCA = async ({
	commonName,
	privateKeyFile,
	outFile,
	csrFile,
	daysValid,
}: {
	commonName: string
	privateKeyFile: string
	outFile: string
	csrFile: string
	daysValid?: number
}) => {
	await checkVersion()

	// Key
	await createKey(privateKeyFile)

	// CSR
	await openssl(
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
	await openssl(
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
