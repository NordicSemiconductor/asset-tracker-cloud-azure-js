import chalk from 'chalk'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { v4 } from 'uuid'

export const openssl = async (...args: string[]): Promise<string> =>
	new Promise((resolve, reject) => {
		console.debug(
			chalk.gray.bold('[OpenSSL]'),
			...args.map((s) => chalk.gray(s)),
		)
		execFile(
			'openssl',
			args,
			{
				timeout: 60 * 1000,
			},
			(err, stdout, stderr) => {
				if (err !== null) {
					console.error(chalk.red.dim('[OpenSSL]', chalk.red(stderr)))
					return reject(stderr)
				}
				return resolve(stdout)
			},
		)
	})

export const checkVersion = async (expectedVersion = 3) => {
	const version = await openssl('version')
	if (!version.includes(`OpenSSL ${expectedVersion}`)) {
		throw new Error(
			`Expected OpenSSL version ${expectedVersion}.x, got ${version}!`,
		)
	}
}

export const createKey = async (outFileLocation: string) =>
	openssl('ecparam', '-out', outFileLocation, '-name', 'prime256v1', '-genkey')

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
