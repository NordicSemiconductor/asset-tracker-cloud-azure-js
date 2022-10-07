import { caCertConfig, checkVersion, createKey, openssl } from './openssl.js'

export const intermediateCA = async ({
	commonName,
	signkeyFile,
	privateKeyFile,
	outFile: outFile,
	csrFile,
	daysValid,
}: {
	commonName: string
	privateKeyFile: string
	signkeyFile?: string
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

	// Cert
	await openssl(
		'x509',
		'-req',
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
		'-signkey',
		signkeyFile ?? privateKeyFile,
		'-out',
		outFile,
	)
}
