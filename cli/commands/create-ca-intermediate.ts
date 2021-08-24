import { CommandDefinition } from './CommandDefinition'
import {
	generateCAIntermediate,
	defaultIntermediateCAValidityInDays,
} from '../iot/generateCAIntermediate'
import { ProvisioningServiceClient } from 'azure-iot-provisioning-service'
import { add as addToIntermediateRegistry } from '../iot/intermediateRegistry'
import { v4 } from 'uuid'
import { log, debug, setting, next, newline } from '../logging'
import { CAIntermediateFileLocations } from '../iot/caFileLocations'
import { fingerprint } from '../iot/fingerprint'

export const createCAIntermediateCommand = ({
	certsDir: certsDirPromise,
	ioTHubDPSConnectionString,
}: {
	certsDir: () => Promise<string>
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

		const intermediate = await generateCAIntermediate({
			id,
			certsDir,
			log,
			debug,
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		debug(`CA intermediate certificate generated.`)
		const caFiles = CAIntermediateFileLocations({ certsDir, id })
		setting('Fingerprint', await fingerprint(caFiles.cert))

		await addToIntermediateRegistry({ certsDir, id })

		// Create enrollment group

		const dpsConnString = await ioTHubDPSConnectionString()

		const dpsClient =
			ProvisioningServiceClient.fromConnectionString(dpsConnString)

		const enrollmentGroupId = `nrfassettracker-${id}`

		// FIXME: Remove undefined, once https://github.com/Azure/azure-iot-sdk-node/pull/663 is released
		await dpsClient.createOrUpdateEnrollmentGroup({
			enrollmentGroupId,
			attestation: {
				type: 'x509',
				x509: {
					signingCertificates: {
						primary: {
							certificate: intermediate.certificate,
							info: undefined as any,
						},
						secondary: undefined as any,
					},
					clientCertificates: undefined as any,
					caReferences: undefined as any,
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
			iotHubHostName: undefined as any,
			iotHubs: undefined as any,
			etag: undefined as any,
			createdDateTimeUtc: undefined as any,
			lastUpdatedDateTimeUtc: undefined as any,
		})

		setting(
			`Created enrollment group for CA intermediate certificiate`,
			enrollmentGroupId,
		)

		newline()

		next(
			'You can now generate device certificates using',
			'node cli create-and-provision-device-cert',
		)
	},
	help: 'Creates a CA intermediate certificate registers it with an IoT Device Provisioning Service enrollment group',
})
