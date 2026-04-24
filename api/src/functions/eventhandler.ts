import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPubSubClient, readState } from '../lib/state.js';

// --- Web PubSub upstream event handler ---
// This is called by the Web PubSub service for connect / message events.

app.http('eventhandler', {
  methods: ['POST', 'OPTIONS', 'GET'],
  authLevel: 'anonymous',
  route: 'eventhandler',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {

    // Handle abuse-protection validation (OPTIONS / GET with webhook-request-origin header)
    if (req.method === 'OPTIONS' || req.method === 'GET') {
      const origin = req.headers.get('webhook-request-origin');
      return {
        status: 200,
        headers: {
          'webhook-allowed-origin': origin || '*',
        },
      };
    }

    const ceType = req.headers.get('ce-type') || '';
    ctx.log(`Event handler called: ${ceType}`);

    const pubsubClient = getPubSubClient();

    // On connect — accept the connection
    if (ceType === 'azure.webpubsub.sys.connect') {
      const connectionId = req.headers.get('ce-connectionid') || '';
      ctx.log(`Client connecting: ${connectionId}`);

      return {
        jsonBody: {
          groups: [],
          subprotocol: 'json.webpubsub.azure.v1',
        },
        headers: { 'content-type': 'application/json' },
      };
    }

    // On connected — send current state to the newly connected client
    if (ceType === 'azure.webpubsub.sys.connected') {
      const connectionId = req.headers.get('ce-connectionid') || '';
      ctx.log(`Client connected: ${connectionId}`);

      const state = await readState();
      await pubsubClient.sendToConnection(connectionId, {
        type: 'state',
        data: state,
      });

      return { status: 200 };
    }

    // User messages are no longer used; updates happen through HTTP list endpoints.
    if (ceType === 'azure.webpubsub.user.message') {
      return { status: 200, headers: { 'ce-errorcode': '' } };
    }

    // Disconnect or other events
    if (ceType === 'azure.webpubsub.sys.disconnected') {
      ctx.log(`Client disconnected: ${req.headers.get('ce-connectionid')}`);
      return { status: 200 };
    }

    return { status: 200 };
  },
});
