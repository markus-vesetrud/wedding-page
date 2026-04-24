import { BlobServiceClient } from '@azure/storage-blob';
import { WebPubSubServiceClient } from '@azure/web-pubsub';

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

export interface Guest extends Item {
  allergies?: string;
}

export interface Cake extends Item {
  servings: number;
  bakerName?: string;
}

export interface Gift extends Item {
  gifterName?: string;
}

export interface AppState {
  gifts: Gift[];
  guests: Guest[];
  cakes: Cake[];
}

export type ListName = keyof AppState;
export type ListEntity = Gift | Guest | Cake;

export type DeltaUpdate =
  | { type: 'item-added'; list: ListName; item: ListEntity }
  | { type: 'item-checked'; list: ListName; item: ListEntity }
  | { type: 'item-unchecked'; list: ListName; item: ListEntity };

const defaultState: AppState = { gifts: [], guests: [], cakes: [] };

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeBaseItem(raw: unknown): Item {
  const item = raw as Partial<Item> & { text?: string };
  return {
    id: item.id ?? makeId(),
    name: item.name ?? item.text ?? '',
    checked: Boolean(item.checked),
    updatedAt: item.updatedAt ?? nowIso(),
  };
}

function normalizeGifts(raw: unknown): Gift[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const gift = entry as Partial<Gift>;
    return {
      ...normalizeBaseItem(gift),
      gifterName: gift.gifterName,
    };
  });
}

function normalizeGuests(raw: unknown): Guest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const guest = entry as Partial<Guest>;
    return {
      ...normalizeBaseItem(guest),
      allergies: guest.allergies,
    };
  });
}

function normalizeCakes(raw: unknown): Cake[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const cake = entry as Partial<Cake>;
    return {
      ...normalizeBaseItem(cake),
      servings: typeof cake.servings === 'number' ? cake.servings : 0,
      bakerName: cake.bakerName,
    };
  });
}

function normalizeState(input: unknown): AppState {
  const state = input as Partial<AppState> | undefined;
  return {
    gifts: normalizeGifts(state?.gifts),
    guests: normalizeGuests(state?.guests),
    cakes: normalizeCakes(state?.cakes),
  };
}

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function getContainerClient() {
  const blobService = BlobServiceClient.fromConnectionString(storageConnectionString);
  const container = blobService.getContainerClient(containerName);
  await container.createIfNotExists();
  return container;
}

export async function readState(): Promise<AppState> {
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

export async function writeState(state: AppState): Promise<void> {
  const container = await getContainerClient();
  const blob = container.getBlockBlobClient(blobName);
  const content = JSON.stringify(state);
  await blob.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

export function getPubSubClient() {
  return new WebPubSubServiceClient(connectionString, hubName);
}

function findItem(state: AppState, list: ListName, id: string): ListEntity | undefined {
  return state[list].find((item) => item.id === id);
}

export function addItem(state: AppState, list: ListName, name: string): DeltaUpdate {
  const base = {
    id: makeId(),
    name,
    checked: false,
    updatedAt: nowIso(),
  };

  let item: ListEntity;
  if (list === 'gifts') {
    item = { ...base } as Gift;
  } else if (list === 'guests') {
    item = { ...base } as Guest;
  } else {
    item = { ...base, servings: 0 } as Cake;
  }

  state[list].push(item as never);
  return { type: 'item-added', list, item };
}

export function checkItem(state: AppState, list: ListName, id: string, value: string): DeltaUpdate | null {
  const item = findItem(state, list, id);
  if (!item) return null;

  item.checked = true;
  item.updatedAt = nowIso();

  if (list === 'gifts') {
    (item as Gift).gifterName = value;
  } else if (list === 'guests') {
    (item as Guest).allergies = value;
  } else {
    (item as Cake).bakerName = value;
  }

  return { type: 'item-checked', list, item };
}

export function uncheckItem(state: AppState, list: ListName, id: string): DeltaUpdate | null {
  const item = findItem(state, list, id);
  if (!item) return null;

  item.checked = false;
  item.updatedAt = nowIso();

  if (list === 'gifts') {
    delete (item as Gift).gifterName;
  } else if (list === 'guests') {
    delete (item as Guest).allergies;
  } else {
    delete (item as Cake).bakerName;
  }

  return { type: 'item-unchecked', list, item };
}

