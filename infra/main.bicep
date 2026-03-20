// ──────────────────────────────────────────────────────────
// Wedding Page — Azure Infrastructure
// ──────────────────────────────────────────────────────────

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Unique suffix for globally-unique names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

// ── Storage Account (app data) ──
var storageAccountName = 'weddingst${uniqueSuffix}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2025-06-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-06-01' = {
  parent: storageAccount
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-06-01' = {
  parent: blobService
  name: 'wedding-data'
}

// ── Storage Account (Function App runtime) ──
var funcStorageName = 'weddingfn${uniqueSuffix}'

resource funcStorageAccount 'Microsoft.Storage/storageAccounts@2025-06-01' = {
  name: funcStorageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
  }
}

// ── Azure Web PubSub ──
var pubsubName = 'wedding-pubsub-${uniqueSuffix}'

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: pubsubName
  location: location
  kind: 'WebPubSub'
  sku: {
    name: 'Free_F1'
    tier: 'Free'
    capacity: 1
  }
  properties: {
    disableLocalAuth: false
    publicNetworkAccess: 'Enabled'
    tls: {
      clientCertEnabled: false
    }
  }
}

// ── Application Insights ──
var appInsightsName = 'wedding-insights-${uniqueSuffix}'
var logAnalyticsName = 'wedding-logs-${uniqueSuffix}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── App Service Plan (Basic B1 — always on) ──
var appServicePlanName = 'wedding-plan-${uniqueSuffix}'

resource appServicePlan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
}

// ── Standalone Function App ──
var functionAppName = 'wedding-api-${uniqueSuffix}'

resource functionApp 'Microsoft.Web/sites@2025-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~22'
      alwaysOn: true
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorageAccount.name};AccountKey=${funcStorageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'WEBPUBSUB_CONNECTION_STRING', value: webPubSub.listKeys().primaryConnectionString }
        { name: 'STORAGE_CONNECTION_STRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
      ]
      cors: {
        allowedOrigins: ['*']
      }
    }
  }
}

// ── Azure Static Web App ──
resource staticWebApp 'Microsoft.Web/staticSites@2025-03-01' = {
  name: 'wedding-swa-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      outputLocation: 'build'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── Link Function App to SWA as backend ──
resource swaLinkedBackend 'Microsoft.Web/staticSites/linkedBackends@2025-03-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: functionApp.id
    region: location
  }
}

// ── Web PubSub hub settings (upstream URL → Function App) ──
resource pubsubHub 'Microsoft.SignalRService/webPubSub/hubs@2024-03-01' = {
  parent: webPubSub
  name: 'wedding'
  properties: {
    eventHandlers: [
      {
        urlTemplate: 'https://${staticWebApp.properties.defaultHostname}/api/eventhandler'
        userEventPattern: '*'
        systemEvents: [
          'connect'
          'connected'
          'disconnected'
        ]
      }
    ]
    anonymousConnectPolicy: 'allow'
  }
}

// ── Outputs ──
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
output functionAppName string = functionApp.name
output storageAccountName string = storageAccount.name
output webPubSubName string = webPubSub.name
