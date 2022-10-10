import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { ProvisioningServiceClient } from 'azure-iot-provisioning-service'
import { readFile } from 'fs/promises'
import { v4 } from 'uuid'
import { CAIntermediateFileLocations } from '../iot/caFileLocations.js'
import {
	defaultIntermediateCAValidityInDays,
	generateCAIntermediate,
} from '../iot/generateCAIntermediate.js'
import { add as addToIntermediateRegistry } from '../iot/intermediateRegistry.js'
import { debug, log, newline, next, setting } from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

export const createCAIntermediateCommand = ({
	certsDir: certsDirPromise,
	ioTHubDPSConnectionString,
}: {
	certsDir: () => Promise<string>
	resourceGroup: string
	dpsName: string
	iotDpsClient: () => Promise<IotDpsClient>
	ioTHubDPSConnectionString: () => Promise<string>
}): CommandDefinition => ({
	command: 'create-ca-intermediate',
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultIntermediateCAValidityInDays} days.`,
		},
	],
	action: async ({ expires }: { expires?: string }) => {
		const id = v4()

		const certsDir = await certsDirPromise()
		const caIntermediateFiles = CAIntermediateFileLocations({ certsDir, id })

		const { name: certificateName } = await generateCAIntermediate({
			id,
			certsDir,
			log,
			debug,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		debug(`CA intermediate certificate generated.`)

		await addToIntermediateRegistry({ certsDir, id })

		// Create enrollment group

		const dpsConnString = await ioTHubDPSConnectionString()

		const dpsClient =
			ProvisioningServiceClient.fromConnectionString(dpsConnString)

		await dpsClient.createOrUpdateEnrollmentGroup({
			enrollmentGroupId: certificateName,
			attestation: {
				type: 'x509',
				x509: {
					signingCertificates: {
						primary: {
							certificate: await readFile(caIntermediateFiles.cert, 'utf-8'),
							info: undefined as any,
						},
					},
				},
			},
			provisioningStatus: 'enabled',
			reprovisionPolicy: {
				migrateDeviceData: true,
				updateHubAssignment: true,
			},
			initialTwin: {
				tags: { ADUGroup: 'all' }, // Register support for Azure Device Update
			} as any,
		})

		setting(
			`Created enrollment group for CA intermediate certificate`,
			certificateName,
		)

		newline()

		next(
			'You can now generate device certificates using',
			'./cli.sh create-and-provision-device-cert',
		)

		next(
			'You can now generate simulator certificates using',
			'./cli.sh create-simulator-cert',
		)
	},
	help: 'Creates a CA intermediate certificate registers it with an IoT Device Provisioning Service enrollment group',
})
