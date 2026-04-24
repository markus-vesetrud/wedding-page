import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { BlobServiceClient } from '@azure/storage-blob';

const connectionString = process.env.WEBPUBSUB_CONNECTION_STRING || '';
const storageConnectionString = process.env.STORAGE_CONNECTION_STRING || '';
const hubName = 'wedding';
const containerName = 'wedding-data';
const blobName = 'state.json';

interface Item {
  id: string;
  name: string;
  checked: boolean;
  updatedAt: string;
}

interface Guest extends Item {
  allergies?: string;
}

interface Cake extends Item {
  servings: number;
  bakerName?: string;
}

interface Gift extends Item {
  gifterName?: string;
}

interface AppState {
  gifts: Gift[];
  guests: Guest[];
  cakes: Cake[];
}

const defaultState: AppState = { gifts: [], guests: [], cakes: [] };

function normalizeState(input: unknown): AppState {
  const state = input as Partial<AppState> | undefined;

  const normalizeItem = (raw: unknown): Item => {
    const item = raw as Partial<Item> & { text?: string };
    return {
      id: item.id ?? Math.random().toString(36).slice(2, 10),
      name: item.name ?? item.text ?? '',
      checked: Boolean(item.checked),
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    };
  };

  const normalizeGifts = (raw: unknown): Gift[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      const gift = entry as Partial<Gift> & { text?: string };
      return {
        ...normalizeItem(gift),
        gifterName: gift.gifterName,
      };
    });
  };

  const normalizeGuests = (raw: unknown): Guest[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      const guest = entry as Partial<Guest> & { text?: string };
      return {
        ...normalizeItem(guest),
        allergies: guest.allergies,
      };
    });
  };

  const normalizeCakes = (raw: unknown): Cake[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      const cake = entry as Partial<Cake> & { text?: string };
      return {
        ...normalizeItem(cake),
        servings: typeof cake.servings === 'number' ? cake.servings : 0,
        bakerName: cake.bakerName,
      };
    });
  };

  return {
    gifts: normalizeGifts(state?.gifts),
    guests: normalizeGuests(state?.guests),
    cakes: normalizeCakes(state?.cakes),
  };
}

async function getContainerClient() {
  const blobService = BlobServiceClient.fromConnectionString(storageConnectionString);
  const container = blobService.getContainerClient(containerName);
  await container.createIfNotExists();
  return container;
}

async function readState(): Promise<AppState> {
  try {
    const container = await getContainerClient();
    const blob = container.getBlockBlobClient(blobName);
    const exists = await blob.exists();
    if (!exists) return { ...defaultState };
    const downloaded = await blob.download();
    const body = await streamToString(downloaded.readableStreamBody!);
    return normalizeState(JSON.parse(body));
  } catch {
    return { ...defaultState };
  }
}

async function writeState(state: AppState): Promise<void> {
  const container = await getContainerClient();
  const blob = container.getBlockBlobClient(blobName);
  const content = JSON.stringify(state);
  await blob.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

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

    const pubsubClient = new WebPubSubServiceClient(connectionString, hubName);

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

    // On message — persist and broadcast
    if (ceType === 'azure.webpubsub.user.message') {
      const body = await req.text();
      ctx.log(`Message received: ${body}`);

      try {
        const msg = JSON.parse(body);
        if (msg.type === 'update' && msg.data) {
          const state = msg.data as AppState;
          await writeState(state);

          // Broadcast to all connected clients
          await pubsubClient.sendToAll({
            type: 'state',
            data: state,
          });
        }
      } catch (e) {
        ctx.error('Failed to process message', e);
      }

      return {
        status: 200,
        headers: { 'ce-errorcode': '' },
      };
    }

    // Disconnect or other events
    if (ceType === 'azure.webpubsub.sys.disconnected') {
      ctx.log(`Client disconnected: ${req.headers.get('ce-connectionid')}`);
      return { status: 200 };
    }

    return { status: 200 };
  },
});
