import * as path from 'path'

export const caFileLocations = ({
	prefix,
	certsDir,
}: {
	prefix: string
	certsDir: string
}): {
	id: string
	cert: string
	privateKey: string
	csr: string
	verificationPrivateKey: string
	verificationCert: string
	verificationCSR: string
} => ({
	id: path.resolve(certsDir, `${prefix}.id`),
	privateKey: path.resolve(certsDir, `${prefix}.pem.key`),
	cert: path.resolve(certsDir, `${prefix}.pem.crt`),
	csr: path.resolve(certsDir, `${prefix}.pem.csr`),
	verificationPrivateKey: path.resolve(
		certsDir,
		`${prefix}.verification.pem.key`,
	),
	verificationCert: path.resolve(certsDir, `${prefix}.verification.pem.crt`),
	verificationCSR: path.resolve(certsDir, `${prefix}.verification.pem.csr`),
})

export const CARootFileLocations = (certsDir: string) =>
	caFileLocations({ prefix: 'CA.root', certsDir })

export const CAIntermediateFileLocations = ({
	certsDir,
	id,
}: {
	certsDir: string
	id: string
}) => caFileLocations({ certsDir, prefix: `CA.intermediate.${id}` })
