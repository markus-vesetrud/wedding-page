import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebPubSubServiceClient } from '@azure/web-pubsub';

const connectionString = process.env.WEBPUBSUB_CONNECTION_STRING || '';
const hubName = 'wedding';

app.http('negotiate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'negotiate',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    if (!connectionString) {
      return { status: 500, body: 'WEBPUBSUB_CONNECTION_STRING not configured' };
    }

    const client = new WebPubSubServiceClient(connectionString, hubName);
    const token = await client.getClientAccessToken({
      roles: ['webpubsub.joinLeaveGroup.all', 'webpubsub.sendToGroup.all'],
    });

    return {
      jsonBody: { url: token.url },
    };
  },
});
