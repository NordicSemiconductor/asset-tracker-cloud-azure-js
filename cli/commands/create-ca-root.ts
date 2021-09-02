import { CommandDefinition } from './CommandDefinition.js'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { generateProofOfPosession } from '../iot/generateProofOfPosession.js'
import { v4 } from 'uuid'
import {
	generateCARoot,
	defaultCAValidityInDays,
} from '../iot/generateCARoot.js'
import { log, debug, success, setting, newline, next } from '../logging.js'
import { certificateName as cn } from '../iot/certificateName.js'
import { fingerprint } from '../iot/fingerprint.js'
import { CARootFileLocations } from '../iot/caFileLocations.js'

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
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultCAValidityInDays} days.`,
		},
	],
	action: async ({ expires }: { expires?: string }) => {
		const certificateName = cn(`nrfassettracker-root-${v4()}`)

		const certsDir = await certsDirPromise()

		const root = await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`CA root certificate generated.`)
		const caFiles = CARootFileLocations(certsDir)
		setting('Fingerprint', await fingerprint(caFiles.cert))

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
		const { properties } =
			await armDpsClient.dpsCertificate.generateVerificationCode(
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
	help: 'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})
