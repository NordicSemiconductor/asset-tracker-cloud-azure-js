export const resourceGroupName = (): string =>
	process.env.APP_NAME ?? 'nrfassettracker'

export const deploymentName = resourceGroupName

/**
 * Returns the name of the Device Provisioning Service
 */
export const iotDeviceProvisioningServiceName = (): string =>
	`${resourceGroupName()}ProvisioningService`
