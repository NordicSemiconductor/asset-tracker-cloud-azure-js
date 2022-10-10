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
	ca?: {
		keyFile: string
		certificateFile: string
	}
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

	const args: string[] = [
		'x509',
		'-req',
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
	]

	if (ca !== undefined) {
		args.push('-CA', ca.certificateFile, '-CAkey', ca.keyFile)
	} else {
		args.push('-signkey', privateKeyFile)
	}

	// Cert
	await opensslV3.command(...args, '-out', outFile)
}
