import chalk from 'chalk'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { v4 } from 'uuid'

const command = (args: string[], debug?: (...message: any[]) => void) =>
	new Promise<string>((resolve, reject) => {
		debug?.('[OpenSSL] »', ...args.map((s) => chalk.gray(s)))
		execFile(
			'openssl',
			args,
			{
				timeout: 60 * 1000,
			},
			(err, stdout, stderr) => {
				if (err !== null) {
					debug?.('[OpenSSL] «', stderr)
					return reject(stderr)
				}
				debug?.('[OpenSSL] «', stdout)
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
}) => ({
	command: async (...args: string[]): Promise<string> => {
		const version = await command(['version'])
		if (!version.includes(`OpenSSL ${expectedVersion ?? 3}`)) {
			throw new Error(
				`Expected OpenSSL version ${expectedVersion ?? 3}.x, got ${version}!`,
			)
		}
		return command(args, debug)
	},
	createKey: async (outFileLocation: string) =>
		openssl({ debug }).command(
			'ecparam',
			'-out',
			outFileLocation,
			'-name',
			'prime256v1',
			'-genkey',
		),
})

export const caCertConfig = async (commonName: string): Promise<string> => {
	const tempDir = await mkdtemp(
		path.join(os.tmpdir(), 'nrf-asset-tracker-azure-certs-'),
	)
	const configFile = path.join(tempDir, `ca-cert-${v4()}.conf`)
	await writeFile(
		configFile,
		[
			'[ req ]',
			'req_extensions = v3_req',
			'distinguished_name = req_distinguished_name',
			'prompt = no',
			'[ req_distinguished_name ]',
			'commonName = ' + commonName,
			'[ v3_req ]',
			'basicConstraints = critical,CA:true',
		].join('\n'),
		'utf-8',
	)
	return configFile
}

export const leafCertConfig = async (commonName: string): Promise<string> => {
	const tempDir = await mkdtemp(
		path.join(os.tmpdir(), 'nrf-asset-tracker-azure-certs-'),
	)
	const configFile = path.join(tempDir, `leaf-cert-${v4()}.conf`)
	await writeFile(
		configFile,
		[
			'[ req ]',
			'req_extensions = v3_req',
			'distinguished_name = req_distinguished_name',
			'prompt = no',
			'[ req_distinguished_name ]',
			'commonName = ' + commonName,
			'[ v3_req ]',
			'extendedKeyUsage = critical,clientAuth',
		].join('\n'),
	)
	return configFile
}
