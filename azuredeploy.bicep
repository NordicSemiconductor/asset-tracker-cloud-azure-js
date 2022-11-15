@description('Specifies the name of the app.')
@minLength(3)
param appName string = 'nrfassettracker'

@description('Specifies the storage account name to use, which is globally unique.')
@minLength(3)
param storageAccountName string = appName

@description('Specifies the name of the key vault.')
@minLength(3)
param keyVaultName string = 'assetTracker'

@description('Client ID of the Active Directory App Registration used for authentication')
@minLength(36)
@maxLength(36)
param appRegistrationClientId string

@description('Initial domain name of the created Active Directory B2C')
@minLength(3)
param b2cTenant string

@description('Name of the login flow')
@minLength(3)
param b2cFlowName string = 'B2C_1_signup_signin'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Specifies the IotHub SKU. At minimum S1 is needed for IoT Device Update.')
param iotHubSkuName string = 'S1'

@description('Specifies the number of provisioned IoT Hub units. Restricted to 1 unit for the F1 SKU. Can be set up to maximum number allowed for subscription.')
@minValue(1)
@maxValue(1)
param capacityUnits int = 1

@description('The pricing tier of the SignalR resource.')
@allowed([
  'Free_F1'
  'Standard_S1'
])
param SignalRpricingTier string = 'Free_F1'

@description('The number of SignalR Unit.')
@allowed([
  1
  2
  5
  10
  20
  50
  100
])
param SignalRcapacity int = 1

@description('Whether to enable cell geolocation using Unwired Labs API')
param enableUnwiredLabsCellLocation bool = false

@description('Endpoint to use for the unwiredlabs.com cell geolocation API')
param unwiredlabsApiEndpoint string = 'https://eu1.unwiredlabs.com/'

@description('your nRF Cloud team id')
param nrfCloudTeamId string

@description('Whether to enable cell geolocation using nRF Cloud API')
param enableNrfCloudCellLocationService bool = false

@description('Whether to enable nRF Cloud Assisted GPS Location Service')
param enableNrfCloudAGPSLocationService bool = false

@description('Whether to enable nRF Cloud Predicted GPS Location Service')
param enableNrfCloudPGPSLocationService bool = false

@description('Endpoint to use for the nRF Cloud API')
param nrfCloudApiEndpoint string = 'https://api.nrfcloud.com/'

@description('Number of hours to bin A-GPS requests')
param agpsBinHours string = '1'

@description('Name for the database that stores A-GPS requests')
@minLength(3)
param agpsRequestDatabaseName string = 'agpsRequests'

@description('Name for the container that stores A-GPS requests')
@minLength(3)
param agpsRequestContainerName string = 'cache'

@description('Name for the queue that stores A-GPS requests')
@minLength(3)
param agpsRequestQueueName string = 'agpsrequests'

@description('Name for the queue that stores A-GPS requests to be resolved using the nRF Cloud API')
@minLength(3)
param agpsRequestNrfCloudQueueName string = 'nrfcloudagpsrequests'

@description('Consumer group name for A-GPS device requests')
@minLength(3)
param agpsRequestIotEventsConsumerGroupName string = 'agpsRequests'

@description('Number of hours to bin P-GPS requests')
param pgpsBinHours string = '1'

@description('Name for the database that stores P-GPS requests')
@minLength(3)
param pgpsRequestDatabaseName string = 'pgpsRequests'

@description('Name for the container that stores P-GPS requests')
@minLength(3)
param pgpsRequestContainerName string = 'cache'

@description('Name for the queue that stores P-GPS requests')
@minLength(3)
param pgpsRequestQueueName string = 'pgpsrequests'

@description('Name for the queue that stores P-GPS requests to be resolved using the nRF Cloud API')
@minLength(3)
param pgpsRequestNrfCloudQueueName string = 'nrfcloudpgpsrequests'

@description('Consumer group name for P-GPS device requests')
@minLength(3)
param pgpsRequestIotEventsConsumerGroupName string = 'pgpsRequests'

@description('Consumer group name for cell geolocation updates')
@minLength(3)
param cellGeoLocationIotEventsConsumerGroupName string = 'cellgeolocation'

@description('Name for the database that stores neighbor cell measurement reports')
@minLength(3)
param ncellmeasReportsDatabaseName string = 'ncellmeasReports'

@description('Name for the container that stores neighbor cell measurement report geo locations from nRF Cloud')
@minLength(3)
param ncellmeasReportsNrfCloudLocationCacheContainerName string = 'nrfcloudcache'

@description('Name for the container that stores neighbor cell measurement reports')
@minLength(3)
param ncellmeasReportsContainerName string = 'report'

@description('Name for the queue that stores neighbor cell measurement reports')
@minLength(3)
param ncellmeasReportsQueueName string = 'ncellmeasreports'

@description('Name for the queue that stores neighbor cell measurement reports to be resolved using the nRF Cloud API')
@minLength(3)
param ncellmeasReportsNrfCloudQueueName string = 'nrfcloudncellmeasreports'

@description('Consumer group name for neighbor cell measurement reports')
@minLength(3)
param ncellmeasReportsIotEventsConsumerGroupName string = 'ncellmeasReports'

@description('Consumer group name for storing device updates')
@minLength(3)
param storeDeviceUpdatesIotEventsConsumerGroupName string = 'storedeviceupdate'

@description('The name of the IoT hub consumer group to user for Memfault messages')
@minLength(3)
param memfaultIotEventsConsumerGroupName string = 'memfault'

@description('Whether to enable the memfault integration')
param enableMemfaultIntegration bool = true

module core './core.arm.json' = {
  name: 'core'
  params: {
    appName: appName
    storageAccountName: storageAccountName
    keyVaultName: keyVaultName
    appRegistrationClientId: appRegistrationClientId
    b2cTenant: b2cTenant
    b2cFlowName: b2cFlowName
    location: location
    iotHubSkuName: iotHubSkuName
    capacityUnits: capacityUnits
    SignalRpricingTier: SignalRpricingTier
    SignalRcapacity: SignalRcapacity
    enableUnwiredLabsCellLocation: enableUnwiredLabsCellLocation
    unwiredlabsApiEndpoint: unwiredlabsApiEndpoint
    nrfCloudTeamId: nrfCloudTeamId
    enableNrfCloudCellLocationService: enableNrfCloudCellLocationService
    enableNrfCloudAGPSLocationService: enableNrfCloudAGPSLocationService
    enableNrfCloudPGPSLocationService: enableNrfCloudPGPSLocationService
    nrfCloudApiEndpoint: nrfCloudApiEndpoint
    agpsBinHours: agpsBinHours
    agpsRequestDatabaseName: agpsRequestDatabaseName
    agpsRequestContainerName: agpsRequestContainerName
    agpsRequestQueueName: agpsRequestQueueName
    agpsRequestNrfCloudQueueName: agpsRequestNrfCloudQueueName
    agpsRequestIotEventsConsumerGroupName: agpsRequestIotEventsConsumerGroupName
    pgpsBinHours: pgpsBinHours
    pgpsRequestDatabaseName: pgpsRequestDatabaseName
    pgpsRequestContainerName: pgpsRequestContainerName
    pgpsRequestQueueName: pgpsRequestQueueName
    pgpsRequestNrfCloudQueueName: pgpsRequestNrfCloudQueueName
    pgpsRequestIotEventsConsumerGroupName: pgpsRequestIotEventsConsumerGroupName
    cellGeoLocationIotEventsConsumerGroupName: cellGeoLocationIotEventsConsumerGroupName
    ncellmeasReportsDatabaseName: ncellmeasReportsDatabaseName
    ncellmeasReportsNrfCloudLocationCacheContainerName: ncellmeasReportsNrfCloudLocationCacheContainerName
    ncellmeasReportsContainerName: ncellmeasReportsContainerName
    ncellmeasReportsQueueName: ncellmeasReportsQueueName
    ncellmeasReportsNrfCloudQueueName: ncellmeasReportsNrfCloudQueueName
    ncellmeasReportsIotEventsConsumerGroupName: ncellmeasReportsIotEventsConsumerGroupName
    storeDeviceUpdatesIotEventsConsumerGroupName: storeDeviceUpdatesIotEventsConsumerGroupName
  }
}

module memfaultIntegration './memfault-integration/memfault-integration.bicep' = if (enableMemfaultIntegration) {
  name: 'memfaultIntegration'
  params: {
    appName: appName
    storageAccountName: storageAccountName
    location: location
    memfaultIotEventsConsumerGroupName: memfaultIotEventsConsumerGroupName
    keyVaultName: keyVaultName
  }
}

