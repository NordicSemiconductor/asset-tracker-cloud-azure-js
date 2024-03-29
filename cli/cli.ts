import { WebSiteManagementClient } from '@azure/arm-appservice'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { AzureCliCredential } from '@azure/identity'
import { program } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import {
	appName,
	iotDeviceProvisioningServiceName,
	resourceGroupName,
} from '../arm/resources.js'
import { cliCredentials } from './cliCredentials.js'
import { cliConfigCommand } from './commands/cli-config.js'
import { createAndProvisionDeviceCertCommand } from './commands/create-and-provision-device-cert.js'
import { createCAIntermediateCommand } from './commands/create-ca-intermediate.js'
import { createCARootCommand } from './commands/create-ca-root.js'
import { createSimulatorCertCommand } from './commands/create-simulator-cert.js'
import { flashFirmwareCommand } from './commands/flash-firmware.js'
import { functionsSettingsCommand } from './commands/functions-settings.js'
import { infoCommand } from './commands/info.js'
import { reactConfigCommand } from './commands/react-config.js'
import { ioTHubDPSInfo } from './iot/ioTHubDPSInfo.js'
import { error, help } from './logging.js'

const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

let currentCreds: Promise<{
	credentials: AzureCliCredential
	subscriptionId: string
}>

const getCurrentCreds = async () => {
	if (currentCreds === undefined) currentCreds = cliCredentials()
	return currentCreds
}

const main = async () => {
	const resourceGroup = resourceGroupName()
	const dpsName = iotDeviceProvisioningServiceName()

	const getIotHubInfo = ioTHubDPSInfo({
		resourceGroupName: resourceGroup,
		credentials: getCurrentCreds,
	})

	const getIotHubHostname = async (): Promise<string> => {
		if (process.env.AZURE_IOT_HUB_HOSTNAME !== undefined)
			return process.env.AZURE_IOT_HUB_HOSTNAME
		return (await getIotHubInfo()).hostname
	}

	const certsDir = async (): Promise<string> =>
		getIotHubHostname().then((hostname) =>
			path.resolve(process.cwd(), 'certificates', hostname),
		)

	const getIotDpsClient = async () =>
		getCurrentCreds().then(
			(creds) => new IotDpsClient(creds.credentials, creds.subscriptionId, {}),
		)
	const getWebsiteClient = async () =>
		getCurrentCreds().then(
			(creds) =>
				new WebSiteManagementClient(creds.credentials, creds.subscriptionId),
		)

	const getIdScope = async () => {
		if (process.env.AZURE_IOT_HUB_ID_SCOPE !== undefined)
			return process.env.AZURE_IOT_HUB_ID_SCOPE
		const { properties } = await (
			await getIotDpsClient()
		).iotDpsResource.get(dpsName, resourceGroup)
		return properties.idScope as string
	}

	program.name('./cli.sh')
	program.description('Asset Tracker Command Line Interface')

	const commands = [
		infoCommand({
			getIotHubInfo,
			dpsName,
			resourceGroup,
			iotDpsClient: getIotDpsClient,
			credentials: getCurrentCreds,
		}),
		createCARootCommand({
			certsDir,
			iotDpsClient: getIotDpsClient,
			dpsName,
			resourceGroup,
		}),
		createCAIntermediateCommand({
			certsDir,
			ioTHubDPSConnectionString: async () =>
				getIotHubInfo().then(({ connectionString }) => connectionString),
		}),
		createAndProvisionDeviceCertCommand({
			certsDir,
			idScope: getIdScope,
		}),
		createSimulatorCertCommand({
			certsDir,
			idScope: getIdScope,
		}),
		reactConfigCommand({
			websiteClient: getWebsiteClient,
			resourceGroup,
			appName: appName(),
		}),
		functionsSettingsCommand({
			websiteClient: getWebsiteClient,
			resourceGroup,
			appName: appName(),
		}),
		flashFirmwareCommand(),
		cliConfigCommand({
			resourceGroup,
			appName: appName(),
			idScope: getIdScope,
			hostname: getIotHubHostname,
		}),
	]

	let ran = false
	commands.forEach(({ command, action, help: h, options }) => {
		const cmd = program.command(command)
		cmd
			.action(async (...args) => {
				try {
					ran = true
					await action(...args)
				} catch (e) {
					error(`${command} failed!`)
					if (e !== null && e !== undefined) error((e as Error).message)
					process.exit(1)
				}
			})
			.on('--help', () => {
				help(h)
			})
		if (options) {
			options.forEach(({ flags, description, defaultValue }) =>
				cmd.option(flags, description, defaultValue),
			)
		}
	})

	program.parse(process.argv)
	program.version(version)

	if (!ran) {
		program.outputHelp()
		throw new Error('No command selected!')
	}
}

main().catch((err) => {
	error(err)
	process.exit(1)
})
