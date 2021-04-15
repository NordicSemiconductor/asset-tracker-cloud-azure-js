import { CommandDefinition } from './CommandDefinition'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
	flashCredentials,
	connect,
	atHostHexfile,
	flash,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import { deviceFileLocations } from '../iot/deviceFileLocations'
import { Octokit } from '@octokit/rest'
import * as https from 'https'
import { v4 } from 'uuid'
import { progress, success } from '../logging'

const defaultPort = '/dev/ttyACM0'
const defaultSecTag = 42

const getLatestFirmware = async ({
	nbiot,
	nodebug,
	dk,
}: {
	nbiot: boolean
	nodebug: boolean
	dk: boolean
}) => {
	const octokit = new Octokit({
		auth: fs
			.readFileSync(
				path.resolve(process.env.HOME as 'string', '.netrc'),
				'utf-8',
			)
			.split(os.EOL)
			.find((s) => s.includes('machine api.github.com'))
			?.split(' ')[5],
	})
	const latestRelease = (
		await octokit.repos.listReleases({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-firmware',
			per_page: 1,
		})
	).data[0]
	const assets = (
		await octokit.repos.listReleaseAssets({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-firmware',
			release_id: latestRelease.id,
		})
	).data

	const hexfile = assets.find(
		({ name }) =>
			name.includes('.hex') &&
			name.includes(dk ? 'nRF9160DK' : 'Thingy91') &&
			name.includes(nbiot ? 'nbiot' : 'ltem') &&
			(nodebug ? name.includes('nodebug') : !name.includes('nodebug')),
	)

	if (hexfile === undefined) throw new Error(`Failed to detect latest release.`)

	const downloadTarget = path.join(os.tmpdir(), `${v4()}.hex`)
	progress(`Downloading`, hexfile.name)

	await new Promise((resolve) => {
		const file = fs.createWriteStream(downloadTarget)
		https.get(hexfile.browser_download_url, (response) => {
			https.get(response.headers.location as string, (response) => {
				response.pipe(file).on('close', resolve)
			})
		})
	})

	return downloadTarget
}

export const flashCommand = ({
	certsDir,
}: {
	certsDir: () => Promise<string>
}): CommandDefinition => ({
	command: 'flash <deviceId>',
	options: [
		{
			flags: '--dk',
			description: `Flash a 9160 DK`,
		},
		{
			flags: '--nbiot',
			description: `Flash NB-IoT firmware`,
		},
		{
			flags: '--nodebug',
			description: `Flash no-debug firmware`,
		},
		{
			flags: '-p, --port <port>',
			description: `The port the device is connected to, defaults to ${defaultPort}`,
		},
		{
			flags: '-f, --firmware <firmware>',
			description: `Flash application from this file`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Use this secTag, defaults to ${defaultSecTag}`,
		},
	],
	action: async (
		deviceId: string,
		{ dk, nbiot, nodebug, port, firmware, secTag },
	) => {
		const hexfile =
			firmware ?? (await getLatestFirmware({ dk, nbiot, nodebug }))

		progress(`Connecting to device`, port ?? defaultPort)

		const connection = await connect({
			atHostHexfile:
				dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91'],
			device: port ?? defaultPort,
			warn: console.error,
			debug: console.log,
			progress: console.log,
		})

		progress(`Flashing credentials`, port ?? defaultPort)

		const certs = deviceFileLocations({
			certsDir: await certsDir(),
			deviceId,
		})

		await flashCredentials({
			at: connection.connection.at,
			caCert: fs.readFileSync(
				path.resolve(process.cwd(), 'data', 'BaltimoreCyberTrustRoot.pem'),
				'utf-8',
			),
			secTag: secTag ?? defaultSecTag,
			clientCert: fs.readFileSync(certs.certWithChain, 'utf-8'),
			privateKey: fs.readFileSync(certs.privateKey, 'utf-8'),
		})

		progress(`Flashing firmware`, hexfile)

		await flash({
			hexfile,
		})

		await connection.connection.end()

		success('Done')
	},
	help: 'Flash credentials and latest firmware release to a device using JLink',
})
