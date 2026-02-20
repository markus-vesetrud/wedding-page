// ──────────────────────────────────────────────────────────
// Wedding Page — Azure Infrastructure
// ──────────────────────────────────────────────────────────

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Unique suffix for globally-unique names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

// ── Storage Account ──
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

// ── Azure Static Web App ──
resource staticWebApp 'Microsoft.Web/staticSites@2025-03-01' = {
  name: 'wedding-swa-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: 'frontend'
      apiLocation: 'api'
      outputLocation: 'build'
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ── App settings for the SWA managed Functions ──
resource swaAppSettings 'Microsoft.Web/staticSites/config@2025-03-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    WEBPUBSUB_CONNECTION_STRING: webPubSub.listKeys().primaryConnectionString
    STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
  }
}

// ── Web PubSub hub settings (upstream URL) ──
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
output storageAccountName string = storageAccount.name
output webPubSubName string = webPubSub.name
