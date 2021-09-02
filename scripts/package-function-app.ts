import { promises as fs, statSync } from 'fs'
import path from 'path'
import os from 'os'
import { progress, debug } from '../cli/logging.js'
import { run } from '../cli/process/run.js'
import chalk from 'chalk'
import globAsync from 'glob'
import { promisify } from 'util'
const glob = promisify(globAsync)

const copyFile = async (source: string, target: string) => {
	console.log(
		chalk.blueBright(source),
		chalk.magenta('->'),
		chalk.blueBright(target),
	)
	const parts = target.split(path.sep)
	const targetDir = parts.slice(0, parts.length - 1).join(path.sep)
	try {
		await fs.stat(targetDir)
	} catch {
		await fs.mkdir(targetDir, { recursive: true })
	}
	await fs.copyFile(source, target)
}
const copy =
	(sourceDir: string, targetDir: string) => async (sourceName: string) => {
		const source = path.resolve(sourceDir, sourceName)
		const target = path.resolve(targetDir, sourceName)
		await copyFile(source, target)
	}
const packageFunctionApp = async (outZipFileName: string) => {
	const outFile = path.resolve(process.cwd(), outZipFileName)
	try {
		await fs.stat(outFile)
		throw new Error(`Target file ${outFile} exists.`)
	} catch {
		// Pass
	}
	progress('Packaging app', outFile)
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep))
	const c = copy(process.cwd(), tempDir)
	await c('host.json')
	await c('package.json')
	await c('package-lock.json')

	await run({
		command: 'npm',
		args: ['ci', '--ignore-scripts', '--only=prod', '--no-audit'],
		cwd: tempDir,
		log: (info) => progress('Installing dependencies', info),
		debug: (info) => debug('[npm]', info),
	})

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

	progress('Packaging app', 'Copying function files')
	const distJSFiles = await glob(`**/*.js`, {
		cwd: path.join(process.cwd(), 'dist'),
	})

	const functionAppFiles = distJSFiles
		.filter((f) => !f.startsWith('arm/'))
		.filter((f) => !f.startsWith('cli/'))
		.filter((f) => !f.startsWith('scripts/'))
		.filter((f) => !f.startsWith('feature-runner/'))

	await Promise.all(
		functionAppFiles.map(async (f) =>
			copyFile(
				path.join(process.cwd(), 'dist', f),
				path.join(tempDir, 'dist', f),
			),
		),
	)

	await Promise.all(
		functions.map(async (f) => {
			const fJSON = path.join(process.cwd(), f, 'function.json')
			const { scriptFile, functionJSON } = JSON.parse(
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
	await run({
		command: 'zip',
		args: ['-r', path.resolve(process.cwd(), outZipFileName), './'],
		cwd: tempDir,
		log: (info) => progress('[ZIP]', info),
	})
	await run({
		command: 'rm',
		args: ['-rf', tempDir],
		log: (info) => progress('Cleanup', info),
	})
}
void packageFunctionApp(process.argv[process.argv.length - 1])
