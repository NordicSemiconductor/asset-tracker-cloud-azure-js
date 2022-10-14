import { provisionDevice } from './steps/device/provisionDevice.js'

const [certsDir, deviceId] = process.argv.slice(process.argv.length - 2)

provisionDevice({
	certsDir,
	deviceId,
})
	.then((endpoint) => {
		process.stdout.write(endpoint.assignedHub)
	})
	.catch((err) => {
		console.error((err as Error).message)
		process.exit(1)
	})
