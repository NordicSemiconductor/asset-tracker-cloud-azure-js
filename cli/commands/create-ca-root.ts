import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { writeFile } from 'fs/promises'
import { v4 } from 'uuid'
import { CARootFileLocations } from '../iot/certificates/caFileLocations.js'
import { certificateName as cn } from '../iot/certificates/certificateName.js'
import {
	defaultCAValidityInDays,
	generateCARoot,
} from '../iot/certificates/generateCARoot.js'
import { registerCertificate } from '../iot/certificates/registerCertificate'
import { debug as debugFN, log, newline, next, success } from '../logging.js'
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
		const certificateName = cn(`nrfassettracker-root-${v4()}`)

		const certsDir = await certsDirPromise()

		await generateCARoot({
			certsDir,
			name: certificateName,
			log,
			debug: debug ? debugFN : undefined,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		success(`CA root certificate generated.`)

		const caFiles = CARootFileLocations(certsDir)
		await writeFile(caFiles.id, certificateName, 'utf-8')

		await registerCertificate(
			certificateName,
			CARootFileLocations(certsDir),
			iotDpsClient,
			resourceGroup,
			dpsName,
			debug ? debugFN : undefined,
		)

		newline()
		next(
			'You can now create a CA intermediate certificate using',
			'./cli.sh create-ca-intermediate',
		)
	},
	help: 'Creates a CA root certificate and registers it with the IoT Device Provisioning Service',
})
