import {
	FeatureRunner,
	ConsoleReporter,
	randomStepRunners,
	restStepRunners,
	storageStepRunners,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { program } from 'commander'
import * as chalk from 'chalk'
import * as path from 'path'
import { randomEmail } from './lib/randomEmail'
import { randomPassword } from './lib/randomPassword'
import { b2cSteps } from './steps/b2c'
import { fromEnv } from '../lib/fromEnv'
import { deviceStepRunners } from './steps/device'
import { v4 } from 'uuid'
import { list } from '../cli/iot/intermediateRegistry'
import { ioTHubDPSInfo } from '../cli/iot/ioTHubDPSInfo'
import { WebSiteManagementClient } from '@azure/arm-appservice'
import { settings, error, heading, debug } from '../cli/logging'
import { AzureCliCredentials } from '@azure/ms-rest-nodeauth'
import {
	CAIntermediateFileLocations,
	CARootFileLocations,
} from '../cli/iot/caFileLocations'
import { fingerprint } from '../cli/iot/fingerprint'

let ran = false

type World = { apiEndpoint: string }

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option('-X, --no-retry', 'Do not retry steps')
	.action(
		async (
			featureDir: string,
			{
				printResults,
				progress,
				retry,
			}: {
				printResults: boolean
				subscription: string
				progress: boolean
				retry: boolean
			},
		) => {
			ran = true

			const {
				b2cTenant,
				clientId,
				clientSecret,
				b2cTenantId,
				resourceGroup,
				appName,
			} = fromEnv({
				b2cTenant: 'B2C_TENANT',
				clientId: 'APP_REG_CLIENT_ID',
				clientSecret: 'B2C_CLIENT_SECRET',
				b2cTenantId: 'B2C_TENANT_ID',
				resourceGroup: 'RESOURCE_GROUP',
				appName: 'APP_NAME',
			})(process.env)

			const credentials = await AzureCliCredentials.create()

			const apiEndpoint = ((
				await new WebSiteManagementClient(
					credentials,
					credentials.tokenInfo.subscription,
				).webApps.get(resourceGroup, `${appName}api`)
			).hostNames ?? [])[0]

			if (apiEndpoint === undefined) {
				error(`Could not determine API endpoint!`)
				process.exit(1)
			}
			const apiEndpointUrl = `https://${apiEndpoint}/`

			const certsDir = await ioTHubDPSInfo({
				resourceGroupName: resourceGroup,
				credentials,
			})().then(({ hostname }) =>
				path.join(process.cwd(), 'certificates', hostname),
			)

			const intermediateCerts = await list({ certsDir })
			const intermediateCertId = intermediateCerts[0]
			if (intermediateCertId === undefined) {
				error(`Intermediate certificate not found!`)
				process.exit(1)
			}
			const intermediateCaFiles = CAIntermediateFileLocations({
				certsDir,
				id: intermediateCertId,
			})
			const rootCaFiles = CARootFileLocations(certsDir)

			settings({
				Subscription: credentials.tokenInfo.subscription,
				'Resource Group': resourceGroup,
				'Application Name': appName,
				'API endpoint': apiEndpointUrl,
				'AD B2C Tenant': b2cTenant,
				'AD B2C Tenant ID': b2cTenantId,
				'AD B2C Client ID': clientId,
				'AD B2C Client Secret': `${clientSecret.substr(
					0,
					5,
				)}***${clientSecret.substr(-5)}`,
				'Certificate dir': certsDir,
				'Root CA fingerprint': await fingerprint(rootCaFiles.cert),
				'Intermediate CA ID': intermediateCertId,
				'Intermediate CA fingerprint': await fingerprint(
					intermediateCaFiles.cert,
				),
			})

			const world: World = {
				apiEndpoint: `${apiEndpointUrl}api/`,
			} as const
			heading('World')
			settings(world)
			if (!retry) {
				debug('Test Runner:', chalk.red('❌'), chalk.red('Retries disabled.'))
			}

			const runner = new FeatureRunner<World>(world, {
				dir: featureDir,
				reporters: [
					new ConsoleReporter({
						printResults,
						printProgress: progress,
						printProgressTimestamps: true,
						printSummary: true,
					}),
				],
				retry,
			})
			runner
				.addStepRunners(
					randomStepRunners({
						generators: {
							email: randomEmail,
							password: randomPassword,
							UUID: v4,
						},
					}),
				)
				.addStepRunners(
					await b2cSteps({
						b2cTenant,
						clientId,
						clientSecret,
						b2cTenantId,
					}),
				)
				.addStepRunners(restStepRunners())
				.addStepRunners(
					deviceStepRunners({ certsDir, resourceGroup, intermediateCertId }),
				)
				.addStepRunners(storageStepRunners())

			try {
				const { success } = await runner.run()
				if (!success) {
					process.exit(1)
				}
				process.exit()
			} catch (error) {
				error('Running the features failed!')
				error(error.message)
				process.exit(1)
			}
		},
	)
	.parse(process.argv)

if (!ran) {
	program.outputHelp()
	process.exit(1)
}
