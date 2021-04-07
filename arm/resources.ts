export const resourceGroupName = (): string =>
	process.env.RESOURCE_GROUP ?? 'nrfassettracker'

/**
 * Returns the name of the Device Provisioning Service
 */
export const iotDeviceProvisioningServiceName = (): string =>
	`${resourceGroupName()}ProvisioningService`
