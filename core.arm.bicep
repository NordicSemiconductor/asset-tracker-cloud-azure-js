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

var iotHubResourceId = appName_IotHub.id
var iotHubKeyResource = resourceId('Microsoft.Devices/Iothubs/Iothubkeys', '${appName}IotHub', 'iothubowner')
var storageAccountId = '${resourceGroup().id}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}'
var keyVaultSecretsUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var uniqueRoleGuidKeyVaultSecretsUser = guid(keyVault.id, keyVaultSecretsUser, keyVault.id)
var managedIdentity_var = '${appName}-functionapp-identity'

resource appName_IotHub 'Microsoft.Devices/IotHubs@2020-03-01' = {
  name: '${appName}IotHub'
  location: location
  properties: {
    cloudToDevice: {
      defaultTtlAsIso8601: 'PT1H'
      maxDeliveryCount: 10
      feedback: {
        ttlAsIso8601: 'PT1H'
        lockDurationAsIso8601: 'PT60S'
        maxDeliveryCount: 10
      }
    }
    eventHubEndpoints: {
      events: {
        retentionTimeInDays: 1
        partitionCount: 2
      }
    }
    routing: {
      routes: [
        {
          name: 'twinChangeEventsToEventHub'
          source: 'TwinChangeEvents'
          condition: 'true'
          endpointNames: [
            'events'
          ]
          isEnabled: true
        }
        {
          name: 'deviceMessagesToEventHub'
          source: 'DeviceMessages'
          condition: 'true'
          endpointNames: [
            'events'
          ]
          isEnabled: true
        }
      ]
    }
  }
  sku: {
    name: iotHubSkuName
    capacity: capacityUnits
  }
}

resource appName_IotHub_events_publishdeviceupdates 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = {
  name: '${appName}IotHub/events/publishdeviceupdates'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_IotHub_events_storeDeviceUpdatesIotEventsConsumerGroup 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = {
  name: '${appName}IotHub/events/${storeDeviceUpdatesIotEventsConsumerGroupName}'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_IotHub_events_agpsRequestIotEventsConsumerGroup 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = if (enableNrfCloudAGPSLocationService) {
  name: '${appName}IotHub/events/${agpsRequestIotEventsConsumerGroupName}'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_IotHub_events_pgpsRequestIotEventsConsumerGroup 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = if (enableNrfCloudAGPSLocationService) {
  name: '${appName}IotHub/events/${pgpsRequestIotEventsConsumerGroupName}'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_IotHub_events_cellGeoLocationIotEventsConsumerGroup 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = {
  name: '${appName}IotHub/events/${cellGeoLocationIotEventsConsumerGroupName}'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_IotHub_events_ncellmeasReportsIotEventsConsumerGroup 'Microsoft.Devices/iotHubs/eventhubEndpoints/ConsumerGroups@2020-03-01' = if (enableNrfCloudCellLocationService) {
  name: '${appName}IotHub/events/${ncellmeasReportsIotEventsConsumerGroupName}'
  dependsOn: [
    appName_IotHub
  ]
}

resource appName_ProvisioningService 'Microsoft.Devices/provisioningServices@2021-10-15' = {
  sku: {
    name: 'S1'
    capacity: 1
  }
  name: '${appName}ProvisioningService'
  location: location
  properties: {
    iotHubs: [
      {
        connectionString: 'HostName=${reference(iotHubResourceId).hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listkeys(iotHubKeyResource, '2017-07-01').primaryKey}'
        location: location
        name: '${appName}IotHub.azure-devices.net'
      }
    ]
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2019-06-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: false
  }
}

resource storageAccountName_default_avatars 'Microsoft.Storage/storageAccounts/blobServices/containers@2019-06-01' = {
  name: '${storageAccountName}/default/avatars'
  properties: {
    publicAccess: 'Blob'
  }
  dependsOn: [
    storageAccount
  ]
}

resource appName_ServerFarm 'Microsoft.Web/serverfarms@2019-08-01' = {
  name: '${appName}ServerFarm'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    name: '${appName}ServerFarm'
    computeMode: 'Dynamic'
  }
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentity_var
  location: location
}

resource appName_API 'Microsoft.Web/sites@2019-08-01' = {
  name: '${appName}API'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned,UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {
      }
    }
  }
  properties: {
    serverFarmId: appName_ServerFarm.id
    siteConfig: {
      use32BitWorkerProcess: false
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
      http20Enabled: true
      ftpsState: 'Disabled'
    }
    httpsOnly: true
  }
  dependsOn: [

    storageAccount
    appName_IotHub
    appName_SignalR
  ]
}

resource appName_API_web 'Microsoft.Web/sites/config@2019-08-01' = {
  parent: appName_API
  name: 'web'
  properties: {
    siteAuthEnabled: true
    siteAuthSettings: {
      configVersion: 'v2'
      enabled: true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      tokenStoreEnabled: true
      defaultProvider: 'AzureActiveDirectory'
      clientId: appRegistrationClientId
      issuer: 'https://${b2cTenant}.b2clogin.com/${b2cTenant}.onmicrosoft.com/${b2cFlowName}/v2.0/'
      runtimeVersion: '~1'
      httpApiPrefixPath: '/.auth'
      allowedExternalRedirectUrls: [
        'https://${appName}app.z16.web.core.windows.net/'
        'http://localhost:3000/'
      ]
      tokenRefreshExtensionHours: 72
      allowedAudiences: []
      isAadAutoProvisioned: false
      aadClaimsAuthorization: '{"allowed_groups":null,"allowed_client_applications":null}'
    }
    appSettings: [
      {
        name: 'AZURE_CLIENT_ID'
        value: managedIdentity.properties.clientId
      }
      {
        name: 'AzureWebJobsStorage'
        value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(storageAccountId, '2015-05-01-preview').key1}'
      }
      {
        name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
        value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(storageAccountId, '2015-05-01-preview').key1}'
      }
      {
        name: 'WEBSITE_CONTENTSHARE'
        value: toLower('${appName}API')
      }
      {
        name: 'FUNCTIONS_EXTENSION_VERSION'
        value: '~3'
      }
      {
        name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
        value: reference(appName_Insights.id, '2015-05-01').InstrumentationKey
      }
      {
        name: 'FUNCTIONS_WORKER_RUNTIME'
        value: 'node'
      }
      {
        name: 'WEBSITE_NODE_DEFAULT_VERSION'
        value: '~14'
      }
      {
        name: 'WEBSITE_RUN_FROM_PACKAGE'
        value: '1'
      }
      {
        name: 'IOTHUB_CONNECTION_STRING'
        value: 'HostName=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).value[0].primaryKey}'
      }
      {
        name: 'STORAGE_ACCOUNT_NAME'
        value: storageAccountName
      }
      {
        name: 'STORAGE_ACCESS_KEY'
        value: listKeys(storageAccountId, '2019-04-01').keys[0].value
      }
      {
        name: 'IOTHUB_EVENTS_CONNECTION_STRING'
        value: 'Endpoint=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).eventHubEndpoints.events.endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).value[0].primaryKey};EntityPath=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).eventHubEndpoints.events.path}'
      }
      {
        name: 'IOTHUB_EVENTS_EVENT_HUB_NAME'
        value: reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).eventHubEndpoints.events.path
      }
      {
        name: 'COSMOSDB_CONNECTION_STRING'
        value: listConnectionStrings(app.id, providers('Microsoft.DocumentDb', 'databaseAccounts').apiVersions[0]).connectionStrings[0].connectionString
      }
      {
        condition: enableUnwiredLabsCellLocation
        name: 'UNWIREDLABS_API_ENDPOINT'
        value: unwiredlabsApiEndpoint
      }
      {
        condition: (!empty(nrfCloudTeamId))
        name: 'NRFCLOUD_TEAM_ID'
        value: nrfCloudTeamId
      }
      {
        condition: (!empty(nrfCloudTeamId))
        name: 'NRFCLOUD_API_ENDPOINT'
        value: nrfCloudApiEndpoint
      }
      {
        name: 'KEYVAULT_NAME'
        value: keyVaultName
      }
      {
        name: 'AGPS_BIN_HOURS'
        value: agpsBinHours
      }
      {
        name: 'AGPS_REQUESTS_IOT_EVENTS_CONSUMER_GROUP_NAME'
        value: agpsRequestIotEventsConsumerGroupName
      }
      {
        name: 'AGPS_REQUESTS_DATABASE_NAME'
        value: agpsRequestDatabaseName
      }
      {
        name: 'AGPS_REQUESTS_CONTAINER_NAME'
        value: agpsRequestContainerName
      }
      {
        name: 'AGPS_REQUESTS_QUEUE_NAME'
        value: agpsRequestQueueName
      }
      {
        name: 'AGPS_REQUESTS_NRFCLOUD_QUEUE_NAME'
        value: agpsRequestNrfCloudQueueName
      }
      {
        name: 'PGPS_BIN_HOURS'
        value: pgpsBinHours
      }
      {
        name: 'PGPS_REQUESTS_IOT_EVENTS_CONSUMER_GROUP_NAME'
        value: pgpsRequestIotEventsConsumerGroupName
      }
      {
        name: 'PGPS_REQUESTS_DATABASE_NAME'
        value: pgpsRequestDatabaseName
      }
      {
        name: 'PGPS_REQUESTS_CONTAINER_NAME'
        value: pgpsRequestContainerName
      }
      {
        name: 'PGPS_REQUESTS_QUEUE_NAME'
        value: pgpsRequestQueueName
      }
      {
        name: 'PGPS_REQUESTS_NRFCLOUD_QUEUE_NAME'
        value: pgpsRequestNrfCloudQueueName
      }
      {
        name: 'CELL_GEOLOCATION_IOT_EVENTS_CONSUMER_GROUP_NAME'
        value: cellGeoLocationIotEventsConsumerGroupName
      }
      {
        name: 'SignalRConnectionString'
        value: listKeys(appName_SignalR.id, providers('Microsoft.SignalRService', 'SignalR').apiVersions[0]).primaryConnectionString
      }
      {
        name: 'NCELLMEAS_REPORTS_IOT_EVENTS_CONSUMER_GROUP_NAME'
        value: ncellmeasReportsIotEventsConsumerGroupName
      }
      {
        name: 'NCELLMEAS_REPORTS_DATABASE_NAME'
        value: ncellmeasReportsDatabaseName
      }
      {
        name: 'NCELLMEAS_REPORTS_CONTAINER_NAME'
        value: ncellmeasReportsContainerName
      }
      {
        name: 'NCELLMEAS_REPORTS_NRFCLOUD_LOCATION_CACHE_CONTAINER_NAME'
        value: ncellmeasReportsNrfCloudLocationCacheContainerName
      }
      {
        name: 'NCELLMEAS_REPORTS_QUEUE_NAME'
        value: ncellmeasReportsQueueName
      }
      {
        name: 'NCELLMEAS_REPORTS_NRFCLOUD_QUEUE_NAME'
        value: ncellmeasReportsNrfCloudQueueName
      }
      {
        name: 'STORE_DEVICE_UPDATES_IOT_EVENTS_CONSUMER_GROUP_NAME'
        value: storeDeviceUpdatesIotEventsConsumerGroupName
      }
    ]
  }
  dependsOn: [
    'Microsoft.Web/Sites/${appName}API'
    keyVault
  ]
}

resource appName_Insights 'microsoft.insights/components@2018-05-01-preview' = {
  name: '${appName}Insights'
  location: location
  tags: {
    'hidden-link:${resourceGroup().id}/providers/Microsoft.Web/sites/${appName}': 'Resource'
  }
  properties: {
    ApplicationId: appName
    Request_Source: 'IbizaWebAppExtensionCreate'
  }
}

resource appName_SignalR 'Microsoft.SignalRService/SignalR@2018-10-01' = {
  location: location
  name: '${appName}SignalR'
  properties: {
    hostNamePrefix: appName
    features: [
      {
        flag: 'ServiceMode'
        value: 'Serverless'
      }
    ]
  }
  sku: {
    capacity: SignalRcapacity
    name: SignalRpricingTier
  }
}

resource storageAccountName_default_upgrades 'Microsoft.Storage/storageAccounts/blobServices/containers@2019-06-01' = {
  name: '${storageAccountName}/default/upgrades'
  properties: {
    publicAccess: 'Blob'
  }
  dependsOn: [
    storageAccount
  ]
}

resource app 'Microsoft.DocumentDB/databaseAccounts@2021-11-15-preview' = {
  name: appName
  location: location
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        id: '${appName}-${location}'
        failoverPriority: 0
        locationName: location
      }
    ]
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 1440
        backupRetentionIntervalInHours: 168
      }
    }
    isVirtualNetworkFilterEnabled: false
    virtualNetworkRules: []
    ipRules: []
    dependsOn: []
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    enableFreeTier: false
    capacity: {
      totalThroughputLimit: 4000
    }
  }
}

resource appName_deviceMessages 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2020-03-01' = {
  parent: app
  name: 'deviceMessages'
  properties: {
    resource: {
      id: 'deviceMessages'
    }
    options: {
    }
  }
}

resource appName_deviceMessages_updates 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = {
  parent: appName_deviceMessages
  name: 'updates'
  properties: {
    resource: {
      id: 'updates'
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      partitionKey: {
        paths: [
          '/deviceId'
        ]
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
    }
  }
  dependsOn: [

    app
  ]
}

resource appName_cellGeolocation 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2020-03-01' = {
  parent: app
  name: 'cellGeolocation'
  properties: {
    resource: {
      id: 'cellGeolocation'
    }
    options: {
    }
  }
}

resource appName_cellGeolocation_deviceCellGeolocations 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = {
  parent: appName_cellGeolocation
  name: 'deviceCellGeolocations'
  properties: {
    resource: {
      id: 'deviceCellGeolocations'
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      partitionKey: {
        paths: [
          '/cellId'
        ]
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
    }
  }
  dependsOn: [

    app
  ]
}

resource appName_cellGeolocation_unwiredLabsCache 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableUnwiredLabsCellLocation) {
  parent: appName_cellGeolocation
  name: 'unwiredLabsCache'
  properties: {
    resource: {
      id: 'unwiredLabsCache'
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      partitionKey: {
        paths: [
          '/cellId'
        ]
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: 2592000
    }
  }
  dependsOn: [

    app
  ]
}

resource appName_cellGeolocation_nrfCloudCache 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableNrfCloudCellLocationService) {
  parent: appName_cellGeolocation
  name: 'nrfCloudCache'
  properties: {
    resource: {
      id: 'nrfCloudCache'
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      partitionKey: {
        paths: [
          '/cellId'
        ]
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: ((int(agpsBinHours) * 60) * 60)
    }
  }
  dependsOn: [

    app
  ]
}

resource appName_agpsRequestDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2020-03-01' = if (enableNrfCloudAGPSLocationService) {
  parent: app
  name: '${agpsRequestDatabaseName}'
  properties: {
    resource: {
      id: agpsRequestDatabaseName
    }
    options: {
    }
  }
}

resource appName_agpsRequestDatabaseName_agpsRequestContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableNrfCloudAGPSLocationService) {
  parent: appName_agpsRequestDatabase
  name: agpsRequestContainerName
  properties: {
    resource: {
      id: agpsRequestContainerName
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: 3600
    }
  }
  dependsOn: [

    app
  ]
}

resource storageAccountName_default_agpsRequestQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudAGPSLocationService) {
  name: '${storageAccountName}/default/${agpsRequestQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource storageAccountName_default_agpsRequestNrfCloudQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudAGPSLocationService) {
  name: '${storageAccountName}/default/${agpsRequestNrfCloudQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource appName_pgpsRequestDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2020-03-01' = if (enableNrfCloudPGPSLocationService) {
  parent: app
  name: '${pgpsRequestDatabaseName}'
  properties: {
    resource: {
      id: pgpsRequestDatabaseName
    }
    options: {
    }
  }
}

resource appName_pgpsRequestDatabaseName_pgpsRequestContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableNrfCloudPGPSLocationService) {
  parent: appName_pgpsRequestDatabase
  name: pgpsRequestContainerName
  properties: {
    resource: {
      id: pgpsRequestContainerName
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: 3600
    }
  }
  dependsOn: [

    app
  ]
}

resource storageAccountName_default_pgpsRequestQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudPGPSLocationService) {
  name: '${storageAccountName}/default/${pgpsRequestQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource storageAccountName_default_pgpsRequestNrfCloudQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudPGPSLocationService) {
  name: '${storageAccountName}/default/${pgpsRequestNrfCloudQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource appName_ncellmeasReportsDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2020-03-01' = if (enableNrfCloudCellLocationService) {
  parent: app
  name: '${ncellmeasReportsDatabaseName}'
  properties: {
    resource: {
      id: ncellmeasReportsDatabaseName
    }
    options: {
    }
  }
}

resource appName_ncellmeasReportsDatabaseName_ncellmeasReportsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableNrfCloudCellLocationService) {
  parent: appName_ncellmeasReportsDatabase
  name: ncellmeasReportsContainerName
  properties: {
    resource: {
      id: ncellmeasReportsContainerName
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: 3600
    }
  }
  dependsOn: [

    app
  ]
}

resource appName_ncellmeasReportsDatabaseName_ncellmeasReportsNrfCloudLocationCacheContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2020-03-01' = if (enableNrfCloudCellLocationService) {
  parent: appName_ncellmeasReportsDatabase
  name: ncellmeasReportsNrfCloudLocationCacheContainerName
  properties: {
    resource: {
      id: ncellmeasReportsNrfCloudLocationCacheContainerName
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      compositeIndexes: [
        [
          {
            path: '/source'
            order: 'ascending'
          }
        ]
      ]
      defaultTtl: 3600
    }
  }
  dependsOn: [

    app
  ]
}

resource storageAccountName_default_ncellmeasReportsQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudCellLocationService) {
  name: '${storageAccountName}/default/${ncellmeasReportsQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource storageAccountName_default_ncellmeasReportsNrfCloudQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2021-04-01' = if (enableNrfCloudCellLocationService) {
  name: '${storageAccountName}/default/${ncellmeasReportsNrfCloudQueueName}'
  properties: {
  }
  dependsOn: [
    storageAccount
  ]
}

resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = {
  name: keyVaultName
  location: location
  properties: {
    enableRbacAuthorization: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
  }
  dependsOn: [
    'Microsoft.Web/Sites/${appName}API'
  ]
}

resource keyVaultName_Microsoft_Authorization_uniqueRoleGuidKeyVaultSecretsUser 'Microsoft.KeyVault/vaults/providers/roleAssignments@2018-01-01-preview' = {
  name: '${keyVaultName}/Microsoft.Authorization/${uniqueRoleGuidKeyVaultSecretsUser}'
  properties: {
    roleDefinitionId: keyVaultSecretsUser
    principalId: reference(managedIdentity.id, '2018-11-30').principalId
    scope: keyVault.id
    principalType: 'ServicePrincipal'
  }
}

output IoTHubConnectionString string = 'HostName=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).value[0].primaryKey}'
output IOTHUB_EVENTS_CONNECTION_STRING string = 'Endpoint=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).eventHubEndpoints.events.endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).value[0].primaryKey};EntityPath=${reference(appName_IotHub.id, providers('Microsoft.Devices', 'IoTHubs').apiVersions[0]).eventHubEndpoints.events.path}'
output IoTHubDPSConnectionString string = 'HostName=${reference(appName_ProvisioningService.id, providers('Microsoft.Devices', 'provisioningServices').apiVersions[0]).serviceOperationsHostName};SharedAccessKeyName=provisioningserviceowner;SharedAccessKey=${listKeys(appName_ProvisioningService.id, providers('Microsoft.Devices', 'provisioningServices').apiVersions[0]).value[0].primaryKey}'