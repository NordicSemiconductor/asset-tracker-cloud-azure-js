import { CommandDefinition } from './CommandDefinition'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { flash } from '@nordicsemiconductor/firmware-ci-device-helpers'
import { Octokit } from '@octokit/rest'
import * as https from 'https'
import { v4 } from 'uuid'
import { progress, success } from '../logging'

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
			repo: 'asset-tracker-cloud-firmware-azure',
			per_page: 1,
		})
	).data[0]
	const assets = (
		await octokit.repos.listReleaseAssets({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-firmware-azure',
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

export const flashFirmwareCommand = (): CommandDefinition => ({
	command: 'flash-firmware',
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
			flags: '-f, --firmware <firmware>',
			description: `Flash application from this file`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({ dk, nbiot, nodebug, firmware }) => {
		const hexfile =
			firmware ?? (await getLatestFirmware({ dk, nbiot, nodebug }))

		progress(`Flashing firmware`, hexfile)

		await flash({
			hexfile,
		})

		success('Done')
	},
	help: 'Flash latest firmware release to a device using JLink',
})
