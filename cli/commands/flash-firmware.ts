import { flash } from '@nordicsemiconductor/device-helpers'
import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as https from 'https'
import { randomUUID } from 'node:crypto'
import * as os from 'os'
import * as path from 'path'
import { progress, success } from '../logging.js'
import { CommandDefinition } from './CommandDefinition.js'

export const defaultFirmwareRepository = {
	owner: 'NordicSemiconductor',
	repo: 'asset-tracker-cloud-firmware-azure',
} as const

const getLatestFirmware = async ({
	nodebug,
	dk,
}: {
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
			...defaultFirmwareRepository,
			per_page: 1,
		})
	).data[0]
	const assets = (
		await octokit.repos.listReleaseAssets({
			...defaultFirmwareRepository,
			release_id: latestRelease.id,
		})
	).data

	const hexfile = assets.find(
		({ name }) =>
			name.includes('.hex') &&
			!name.includes('-signed') &&
			name.includes(dk ? 'nRF9160DK' : 'Thingy91') &&
			(nodebug === true ? name.includes('nodebug') : !name.includes('nodebug')),
	)

	if (hexfile === undefined) throw new Error(`Failed to detect latest release.`)

	const downloadTarget = path.join(os.tmpdir(), `${randomUUID()}.hex`)
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
	action: async ({ dk, nodebug, firmware }) => {
		const hexfile = firmware ?? (await getLatestFirmware({ dk, nodebug }))

		progress(`Flashing firmware`, hexfile)

		await flash({
			hexfile,
		})

		success('Done')
	},
	help: 'Flash latest firmware release to a device using JLink',
})
