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
import { copy, copyFile } from './lib/copy.js'
import dependencyTree, { TreeInnerNode } from 'dependency-tree'
import { flattenDependencies } from './flattenDependencies.js'

const installDependenciesFromPackageJSON = async ({
	targetDir,
}: {
	targetDir: string
}): Promise<void> => {
	// Install production dependencies
	await run({
		command: 'npm',
		args: ['ci', '--ignore-scripts', '--only=prod', '--no-audit'],
		cwd: targetDir,
		log: (info) => progress('Installing dependencies', info),
		debug: (info) => debug('[npm]', info),
	})
}

export const installPackagesFromList =
	(packageList: string[]) =>
	async ({ targetDir }: { targetDir: string }): Promise<void> => {
		// Install production dependencies
		await run({
			command: 'npm',
			args: ['i', '--ignore-scripts', '--no-audit', ...packageList],
			cwd: targetDir,
			log: (info) => progress('Installing dependencies', info),
			debug: (info) => debug('[npm]', info),
		})
	}

export const packageFunctionApp = async ({
	outFileId,
	functions,
	ignoreFunctions,
	installDependencies,
}: {
	outFileId: string
	functions?: string[]
	ignoreFunctions?: string
	installDependencies?: (_: { targetDir: string }) => Promise<void>
}): Promise<string> => {
	const outFile = path.resolve(process.cwd(), 'dist', `${outFileId}.zip`)

	progress('Packaging to', outFile)

	// Find all folder names of functions (they have a function.json in it)
	if (functions === undefined) {
		const rootEntries = await fs.readdir(process.cwd())
		functions = rootEntries
			.filter((f) => !f.startsWith('.'))
			.filter((f) => statSync(path.join(process.cwd(), f)).isDirectory())
			.filter((f) => {
				try {
					return statSync(path.join(process.cwd(), f, 'function.json')).isFile()
				} catch {
					return false
				}
			})
			.filter((f) => !(ignoreFunctions ?? ([] as string[])).includes(f))
	}
	functions.forEach((f) => progress('Packaging function', f))

	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep))
	const c = copy(process.cwd(), tempDir)

	// Copy the neccessary files for Azure functions
	await c('host.json')

	// ... and for installing dependencies
	await c('package.json')
	await c('package-lock.json')

	// Install the dependencies
	await (installDependencies ?? installDependenciesFromPackageJSON)({
		targetDir: tempDir,
	})

	// Build list of dist files based on scriptFiles of functions and their dependencies
	progress('Packaging app', 'Copying function files')
	const functionFiles = (
		await Promise.all(
			functions.map(async (f) =>
				fs
					.readFile(path.join(process.cwd(), f, 'function.json'), 'utf-8')
					.then(JSON.parse)
					.then(({ scriptFile }) =>
						flattenDependencies(
							dependencyTree({
								directory: path.join(process.cwd(), 'dist'),
								filename: path.join(process.cwd(), f, scriptFile),
								filter: (path) => !path.includes('node_modules'),
							}) as TreeInnerNode,
						),
					),
			),
		)
	).flat()

	// Find all compiled JS files, but exclude some development files
	await Promise.all(
		functionFiles.map(async (f) =>
			copyFile(f, path.join(tempDir, f.replace(process.cwd(), ''))),
		),
	)

	// Azure functions expect .mjs files. Copy the .js scriptFile to .mjs.
	// @see https://docs.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=v2#ecmascript-modules
	// Copy function.json and handler.mjs
	await Promise.all(
		functions.map(async (f) => {
			await fs.mkdir(path.resolve(tempDir, f))
			await fs.copyFile(
				path.resolve(tempDir, f, 'function.json'),
				path.join(process.cwd(), f, 'function.json'),
			)
			await fs.copyFile(
				path.resolve(tempDir, f, 'function.json'),
				path.join(process.cwd(), f, 'handler.mjs'),
			)
		}),
	)

	// ZIP everything
	await run({
		command: 'zip',
		args: ['-r', outFile, './'],
		cwd: tempDir,
		log: (info) => progress('[ZIP]', info),
	})

	// Remove the temp folder
	await run({
		command: 'rm',
		args: ['-rf', tempDir],
		log: (info) => progress('Cleanup', info),
	})

	return outFile
}
