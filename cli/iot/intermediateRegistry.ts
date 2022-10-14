import { promises as fs } from 'fs'
import { readdir } from 'fs/promises'
import * as path from 'path'

export const CAIntermediateRegistryLocation = (
	certsDir: string,
): { registry: string } => ({
	registry: path.resolve(certsDir, 'intermediate.json'),
})

export const list = async ({
	certsDir,
}: {
	certsDir: string
}): Promise<string[]> => {
	const intermediateRegistry = CAIntermediateRegistryLocation(certsDir).registry
	try {
		return JSON.parse(await fs.readFile(intermediateRegistry, 'utf-8'))
	} catch {
		// Fallback
		return (await readdir(certsDir))
			.filter((s) => s.startsWith('CA.intermediate.') && s.endsWith('.pem.crt'))
			.map((s) => /^CA\.intermediate\.([^.]+)\.pem\.crt$/.exec(s)?.[1] ?? '')
			.filter((s) => s.length > 0)
	}
}

export const add = async ({
	certsDir,
	id,
}: {
	certsDir: string
	id: string
}): Promise<void> => {
	const intermediateRegistry = CAIntermediateRegistryLocation(certsDir).registry
	let registry = [] as string[]

	try {
		registry = [id, ...(await list({ certsDir }))]
	} catch {
		registry = [id]
	} finally {
		await fs.writeFile(intermediateRegistry, JSON.stringify(registry), 'utf-8')
	}
}
