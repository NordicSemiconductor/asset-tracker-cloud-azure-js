export const resourceGroupName = (): string =>
	process.env.RESOURCE_GROUP_NAME ?? 'cat-tracker'

export const deploymentName = resourceGroupName

/**
 * Returns the name of the Device Provisioning Service
 */
export const iotDeviceProvisioningServiceName = (): string =>
	`${resourceGroupName()}ProvisioningService`
