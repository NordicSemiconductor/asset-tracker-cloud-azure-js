export const resourceGroupName = (): string =>
	process.env.RESOURCE_GROUP ?? 'nrfassettracker'

export const appName = (): string => process.env.APP_NAME ?? 'nrfassettracker'

/**
 * Returns the name of the Device Provisioning Service
 */
export const iotDeviceProvisioningServiceName = (): string =>
	`${resourceGroupName()}ProvisioningService`
