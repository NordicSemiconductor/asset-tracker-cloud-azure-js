import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { promises as fs } from 'fs'
import { CARootFileLocations } from '../iot/caFileLocations.js'
import { newline, next, setting, success } from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

export const proofCARootPossessionCommand = ({
	certsDir,
	iotDpsClient,
	resourceGroup,
	dpsName,
}: {
	certsDir: () => Promise<string>
	resourceGroup: string
	dpsName: string
	iotDpsClient: () => Promise<IotDpsClient>
}): CommandDefinition => ({
	command: 'proof-ca-root-possession',
	action: async () => {
		const certLocations = CARootFileLocations(await certsDir())

		const certificateName = (
			await fs.readFile(certLocations.name, 'utf-8')
		).trim()

		const armDpsClient = await iotDpsClient()

		const { etag } = await armDpsClient.dpsCertificate.get(
			certificateName,
			resourceGroup,
			dpsName,
		)

		const verificationCert = await fs.readFile(
			certLocations.verificationCert,
			'utf-8',
		)

		setting('Certificate', certificateName)

		await armDpsClient.dpsCertificate.verifyCertificate(
			certificateName,
			etag as string,
			resourceGroup,
			dpsName,
			{
				certificate: verificationCert,
			},
		)

		success('Verified root CA certificate.')
		newline()
		next(
			'You can now create a CA intermediate certificate using',
			'node cli create-ca-intermediate',
		)
	},
	help: 'Verifies the root CA certificate which is registered with the Device Provisioning System',
})
