/**
 * Create a copy of the Azure functions script files to use the .mjs extension.
 * @see https://techcommunity.microsoft.com/t5/apps-on-azure/run-node-js-14-in-azure-functions/ba-p/2195063
 */

import { promises as fs, statSync } from 'fs'
import * as path from 'path'

fs.readdir(process.cwd())
	.then((topLevelFolders) =>
		Promise.all(
			topLevelFolders
				.filter((f) => !f.startsWith('.'))
				.filter((f) => statSync(path.join(process.cwd(), f)).isDirectory())
				.filter((f) => {
					try {
						return statSync(
							path.join(process.cwd(), f, 'function.json'),
						).isFile()
					} catch {
						return false
					}
				})
				.map((f) =>
					fs
						.readFile(path.join(process.cwd(), f, 'function.json'), 'utf-8')
						.then(JSON.parse)
						.then(({ scriptFile }) =>
							path.resolve(process.cwd(), f, scriptFile),
						),
				),
		),
	)
	.then((scriptFiles) =>
		Promise.all(
			scriptFiles.map((scriptFile) => {
				const from = scriptFile.replace(/\.mjs$/, '.js')
				console.debug(from, '->', scriptFile)
				return fs.copyFile(from, scriptFile)
			}),
		),
	)
