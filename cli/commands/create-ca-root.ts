import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { readFile, writeFile } from 'fs/promises'
import { TextEncoder } from 'util'
import { v4 } from 'uuid'
import { CARootFileLocations } from '../iot/caFileLocations.js'
import { certificateName as cn } from '../iot/certificateName.js'
import { fingerprint } from '../iot/fingerprint.js'
import {
	defaultCAValidityInDays,
	generateCARoot,
} from '../iot/generateCARoot.js'
import { generateProofOfPosession } from '../iot/generateProofOfPosession.js'
import { debug, log, newline, next, setting, success } from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

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

		await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`CA root certificate generated.`)

		const caFiles = CARootFileLocations(certsDir)
		await writeFile(caFiles.name, certificateName, 'utf-8')

		setting('Fingerprint', await fingerprint(caFiles.cert))

		// Register root CA certificate on DPS

		const armDpsClient = await iotDpsClient()

		await armDpsClient.dpsCertificate.createOrUpdate(
			resourceGroup,
			dpsName,
			certificateName,
			{
				properties: {
					certificate: new TextEncoder().encode(
						await readFile(caFiles.cert, 'utf-8'),
					),
				},
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
		setting('Etag', etag as string)

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
		setting('verificationCode', properties.verificationCode)

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
			'./cli.sh proof-ca-root-possession',
		)
	},
	help: 'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})
