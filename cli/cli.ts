import * as program from 'commander'
import * as chalk from 'chalk'
import * as path from 'path'
import * as fs from 'fs'
import { createCARootCommand } from './commands/create-ca-root'
import { IotDpsClient } from '@azure/arm-deviceprovisioningservices'
import { AzureCliCredentials } from '@azure/ms-rest-nodeauth'
import { WebSiteManagementClient } from '@azure/arm-appservice'
import { createDeviceCertCommand } from './commands/create-device-cert'
import { proofCARootPossessionCommand } from './commands/proof-ca-possession'
import { createCAIntermediateCommand } from './commands/create-ca-intermediate'
import {
	iotDeviceProvisioningServiceName,
	resourceGroupName,
	appName,
} from '../arm/resources'
import { reactConfigCommand } from './commands/react-config'
import { flashCommand } from './commands/flash'
import { ioTHubDPSInfo } from './iot/ioTHubDPSInfo'
import { creds } from './creds'
import { functionsSettingsCommand } from './commands/functions-settings'

const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

let currentCreds: Promise<AzureCliCredentials>

const getCurrentCreds = async () => {
	if (currentCreds === undefined) currentCreds = creds()
	return currentCreds
}

const main = async () => {
	const resourceGroup = resourceGroupName()
	const dpsName = iotDeviceProvisioningServiceName()

	const getIotHubInfo = ioTHubDPSInfo({
		resourceGroupName: resourceGroup,
		credentials: getCurrentCreds,
	})

	const certsDir = async (): Promise<string> =>
		getIotHubInfo().then(({ hostname }) =>
			path.resolve(process.cwd(), 'certificates', hostname),
		)

	const getIotDpsClient = async () =>
		getCurrentCreds().then(
			(creds) => new IotDpsClient(creds as any, creds.tokenInfo.subscription), // FIXME: This removes a TypeScript incompatibility error
		)
	const getWebsiteClient = async () =>
		getCurrentCreds().then(
			(creds) =>
				new WebSiteManagementClient(creds, creds.tokenInfo.subscription),
		)

	program.description('Cat Tracker Command Line Interface')

	const commands = [
		createCARootCommand({
			certsDir,
			iotDpsClient: getIotDpsClient,
			dpsName,
			resourceGroup,
		}),
		proofCARootPossessionCommand({
			iotDpsClient: getIotDpsClient,
			certsDir,
			dpsName,
			resourceGroup,
		}),
		createCAIntermediateCommand({
			certsDir,
			ioTHubDPSConnectionString: async () =>
				getIotHubInfo().then(({ connectionString }) => connectionString),
		}),
		createDeviceCertCommand({
			certsDir,
			resourceGroup,
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
		flashCommand({
			certsDir,
		}),
	]

	let ran = false
	commands.forEach(({ command, action, help, options }) => {
		const cmd = program.command(command)
		cmd
			.action(async (...args) => {
				try {
					ran = true
					await action(...args)
				} catch (error) {
					console.error(
						chalk.red.inverse(' ERROR '),
						chalk.red(`${command} failed!`),
					)
					console.error(chalk.red.inverse(' ERROR '), chalk.red(error))
					process.exit(1)
				}
			})
			.on('--help', () => {
				console.log('')
				console.log(chalk.yellow(help))
				console.log('')
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
		program.outputHelp(chalk.yellow)
		throw new Error('No command selected!')
	}
}

main().catch((err) => {
	console.error(chalk.red(err))
	process.exit(1)
})
