/**
 * This script packages the Function App in a ZIP archive.
 *
 * This way only the neccessary files are included in the archive, where the
 * func CLI would include all files which are not explicitly ignored.
 *
 * In addition it implements a hack neccessary to make the Function App support
 * ECMAScript modules (ESM): Azure Functions expects ESM entry scripts to have
 * the extions .mjs, however TypeScript currently can only compile to .js files.
 *
 * Therefore, the scriptFiles are renamed to .mjs while packaging.
 */

import { promises as fs, statSync } from 'fs'
import path from 'path'
import os from 'os'
import { progress, debug } from '../cli/logging.js'
import { run } from '../cli/process/run.js'
import globAsync from 'glob'
import { promisify } from 'util'
import { copy, copyFile } from './lib/copy.js'
const glob = promisify(globAsync)

const packageFunctionApp = async (outZipFileName: string) => {
	// Don't overwrite an existing file
	const outFile = path.resolve(process.cwd(), outZipFileName)
	try {
		await fs.stat(outFile)
		console.error(`Target file ${outFile} exists.`)
		process.exit(1)
	} catch {
		// Pass
	}

	progress('Packaging app', outFile)
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep))
	const c = copy(process.cwd(), tempDir)

	// Copy the neccessary files for Azure functions
	await c('host.json')
	// ... and for installing dependencies
	await c('package.json')
	await c('package-lock.json')

	// Install production dependencies
	await run({
		command: 'npm',
		args: ['ci', '--ignore-scripts', '--only=prod', '--no-audit'],
		cwd: tempDir,
		log: (info) => progress('Installing dependencies', info),
		debug: (info) => debug('[npm]', info),
	})

	// Find all folder names of functions (they have a function.json in it)
	const rootEntries = await fs.readdir(process.cwd())
	const functions = rootEntries
		.filter((f) => !f.startsWith('.'))
		.filter((f) => statSync(path.join(process.cwd(), f)).isDirectory())
		.filter((f) => {
			try {
				return statSync(path.join(process.cwd(), f, 'function.json')).isFile()
			} catch {
				return false
			}
		})

	// Find all compiled JS files, but exclude some development files
	const excludeDistFolders = ['arm', 'cli', 'pack', 'feature-runner']
	progress('Packaging app', 'Copying function files')
	const distJSFiles = await glob(`**/*.js`, {
		cwd: path.join(process.cwd(), 'dist'),
	})
	const functionAppFiles = distJSFiles.filter(
		(f) => !excludeDistFolders.includes(f.split(path.sep)[0]),
	)
	await Promise.all(
		functionAppFiles.map(async (f) =>
			copyFile(
				path.join(process.cwd(), 'dist', f),
				path.join(tempDir, 'dist', f),
			),
		),
	)

	// Rename the extension of the function handler file to .mjs and update the
	// function.json
	await Promise.all(
		functions.map(async (f) => {
			const fJSON = path.join(process.cwd(), f, 'function.json')
			const { scriptFile, ...functionJSON } = JSON.parse(
				await fs.readFile(fJSON, 'utf-8'),
			)
			await copyFile(
				path.resolve(tempDir, f, scriptFile),
				path.resolve(tempDir, f, scriptFile.replace(/\.js$/, '.mjs')),
			)
			await fs.rm(path.resolve(tempDir, f, scriptFile))
			await fs.mkdir(path.resolve(tempDir, f))
			await fs.writeFile(
				path.resolve(tempDir, f, 'function.json'),
				JSON.stringify({
					...functionJSON,
					scriptFile: scriptFile.replace(/\.js$/, '.mjs'),
				}),
			)
		}),
	)

	// ZIP everything
	await run({
		command: 'zip',
		args: ['-r', path.resolve(process.cwd(), outZipFileName), './'],
		cwd: tempDir,
		log: (info) => progress('[ZIP]', info),
	})

	// Remove the temp folder
	await run({
		command: 'rm',
		args: ['-rf', tempDir],
		log: (info) => progress('Cleanup', info),
	})
}

void packageFunctionApp(process.argv[process.argv.length - 1])
