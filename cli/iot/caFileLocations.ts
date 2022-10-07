import * as path from 'path'

export const CARootFileLocations = (
	certsDir: string,
): {
	name: string
	cert: string
	privateKey: string
	csr: string
} => ({
	name: path.resolve(certsDir, 'CA.root.name'),
	cert: path.resolve(certsDir, 'CA.root.pem'),
	csr: path.resolve(certsDir, 'CA.root.csr'),
	privateKey: path.resolve(certsDir, 'CA.root.key'),
})

export const CARootVerificationFileLocations = (
	certsDir: string,
): {
	verificationKey: string
	verificationCert: string
	verificationCSR: string
} => ({
	verificationKey: path.resolve(certsDir, 'CA.verification.key'),
	verificationCert: path.resolve(certsDir, 'CA.verification.pem'),
	verificationCSR: path.resolve(certsDir, 'CA.verification.csr'),
})

export const CAIntermediateFileLocations = ({
	certsDir,
	id,
}: {
	certsDir: string
	id: string
}): {
	privateKey: string
	cert: string
	csr: string
} => ({
	privateKey: path.resolve(certsDir, `CA.intermediate.${id}.key`),
	cert: path.resolve(certsDir, `CA.intermediate.${id}.pem`),
	csr: path.resolve(certsDir, `CA.intermediate.${id}.csr`),
})
