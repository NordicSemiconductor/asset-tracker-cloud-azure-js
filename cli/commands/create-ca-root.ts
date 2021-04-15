import { CommandDefinition } from './CommandDefinition'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { generateProofOfPosession } from '../iot/generateProofOfPosession'
import { v4 } from 'uuid'
import { generateCARoot } from '../iot/generateCARoot'
import { log, debug, success, setting, newline, next } from '../logging'
import { certificateName as cn } from '../iot/certificateName'

export const createCARootCommand = ({
	certsDir: certsDirPromise,
	iotDpsClient,
	resourceGroup,
	dpsName,
}: {
	certsDir: () => Promise<string>
	resourceGroup: string
	dpsName: string
	iotDpsClient: () => Promise<IotDpsClient>
}): CommandDefinition => ({
	command: 'create-ca-root',
	action: async () => {
		const certificateName = cn(`nrfassettracker-root-${v4()}`)

		const certsDir = await certsDirPromise()

		const root = await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug,
		})
		success(`CA root certificate generated.`)

		// Register root CA certificate on DPS

		const armDpsClient = await iotDpsClient()

		await armDpsClient.dpsCertificate.createOrUpdate(
			resourceGroup,
			dpsName,
			certificateName,
			{
				certificate: root.certificate,
			},
		)

		success(`CA root registered with DPS`)
		setting('DPS name', dpsName)

		// Create verification cert

		const { etag } = await armDpsClient.dpsCertificate.get(
			certificateName,
			resourceGroup,
			dpsName,
		)
		const {
			properties,
		} = await armDpsClient.dpsCertificate.generateVerificationCode(
			certificateName,
			etag as string,
			resourceGroup,
			dpsName,
		)

		if (properties?.verificationCode === undefined) {
			throw new Error(`Failed to generate verification code`)
		}

		await generateProofOfPosession({
			certsDir,
			log,
			debug,
			verificationCode: properties.verificationCode,
		})

		success(`Generated verification certificate for verification code`)
		setting('Verification Code', properties.verificationCode)

		newline()

		next(
			'You can now verify the proof of posession using',
			'node cli proof-ca-root-possession',
		)
	},
	help:
		'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})
