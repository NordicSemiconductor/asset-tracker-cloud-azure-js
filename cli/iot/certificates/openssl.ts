import chalk from 'chalk'
import { execFile } from 'node:child_process'

const command = async ({
	cmd,
	args,
	debug,
}: {
	cmd: string
	args: string[]
	debug?: (...message: any[]) => void
}) =>
	new Promise<string>((resolve, reject) => {
		debug?.(`[${cmd}] »`, ...args.map((s) => chalk.gray(s)))
		execFile(
			'openssl',
			args,
			{
				timeout: 60 * 1000,
			},
			(err, stdout, stderr) => {
				if (err !== null) {
					debug?.(`[${cmd}] «`, stderr)
					return reject(stderr)
				}
				if (stdout.length > 0) debug?.(`[${cmd}] «`, stdout)
				return resolve(stdout)
			},
		)
	})

export const openssl = ({
	debug,
	expectedVersion,
}: {
	debug?: (...message: any[]) => void
	expectedVersion?: number
}): {
	command: (...args: string[]) => Promise<string>
} => ({
	command: async (...args: string[]): Promise<string> => {
		const version = await command({ cmd: 'openssl', args: ['version'] })
		if (!version.includes(`OpenSSL ${expectedVersion ?? 3}`)) {
			throw new Error(
				`Expected OpenSSL version ${expectedVersion ?? 3}.x, got ${version}!`,
			)
		}
		return command({ cmd: 'openssl', args, debug })
	},
})
