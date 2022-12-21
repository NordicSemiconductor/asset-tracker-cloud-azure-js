import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'node:crypto'
import { CARootFileLocations } from '../iot/certificates/caFileLocations.js'
import { certificateName as cn } from '../iot/certificates/certificateName.js'
import {
	defaultCAValidityInDays,
	generateCARoot,
} from '../iot/certificates/generateCARoot.js'
import {
	debug as debugFN,
	log,
	newline,
	next,
	setting,
	success,
} from '../logging.js'
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
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({ expires, debug }: { expires?: string; debug?: boolean }) => {
		const certificateName = cn(`nrfassettracker-root-${randomUUID()}`)

		const certsDir = await certsDirPromise()

		await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug: debug === true ? debugFN : undefined,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`CA root certificate generated.`)

		const caFiles = CARootFileLocations(certsDir)
		await writeFile(caFiles.id, certificateName, 'utf-8')

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
					isVerified: true,
				},
			},
		)
		setting('DPS', dpsName)

		newline()
		next(
			'You can now create a CA intermediate certificate using',
			'./cli.sh create-ca-intermediate',
		)
	},
	help: 'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})
