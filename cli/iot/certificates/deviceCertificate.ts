import { checkVersion, leafCertConfig, openssl } from './openssl.js'

export const deviceCertificate = async ({
	commonName,
	signkeyFile,
	certificateFile,
	csrFile,
	daysValid,
}: {
	commonName: string
	signkeyFile: string
	certificateFile: string
	csrFile: string
	daysValid?: number
}) => {
	await checkVersion()

	await openssl(
		'x509',
		'-req',
		'-config',
		await leafCertConfig(commonName),
		'-days',
		`${daysValid ?? 90}`,
		'-in',
		csrFile,
		'-signkey',
		signkeyFile,
		'-out',
		certificateFile,
	)
}
