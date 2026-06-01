import path from 'node:path';
import { promises as fs } from 'node:fs';
import { HttpError } from './errors.js';
import type {
  AppState,
  BaseItem,
  Cake,
  DeltaUpdate,
  Gift,
  Guest,
  Invitation,
  ListEntity,
  ListName
} from './types.js';

const defaultState: AppState = {
  gifts: [],
  guests: [],
  cakes: [],
  invitations: []
};

const listFileNames: Record<ListName, string> = {
  gifts: 'gifts.json',
  guests: 'guests.json',
  cakes: 'cakes.json',
  invitations: 'invitations.json'
};

const changeLogFileName = 'state-changes.log';

const validLists = new Set<ListName>(['gifts', 'guests', 'cakes']);

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(input: Record<string, unknown>, allowedKeys: string[], context: string): void {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.includes(key)) {
      throw new HttpError(`${context} contains unsupported field: ${key}`, 400);
    }
  }
}

function parseRequiredString(
  input: Record<string, unknown>,
  field: string,
  context: string
): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(`${context}.${field} must be a non-empty string`, 400);
  }
  return value;
}

function parseRequiredBoolean(
  input: Record<string, unknown>,
  field: string,
  context: string
): boolean {
  const value = input[field];
  if (typeof value !== 'boolean') {
    throw new HttpError(`${context}.${field} must be a boolean`, 400);
  }
  return value;
}

function parseOptionalString(
  input: Record<string, unknown>,
  field: string,
  context: string
): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(`${context}.${field} must be a string`, 400);
  }
  return value;
}

function parseBaseItem(raw: unknown, context: string): BaseItem {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }

  return {
    id: parseRequiredString(raw, 'id', context),
    name: parseRequiredString(raw, 'name', context),
    checked: parseRequiredBoolean(raw, 'checked', context),
    updatedAt: parseRequiredString(raw, 'updatedAt', context)
  };
}

function parseGift(raw: unknown, context: string): Gift {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }
  assertAllowedKeys(raw, ['id', 'name', 'checked', 'updatedAt', 'gifterName'], context);
  const base = parseBaseItem(raw, context);
  return {
    ...base,
    gifterName: parseOptionalString(raw, 'gifterName', context)
  };
}

function parseStringArray(raw: unknown, context: string): string[] {
  if (!Array.isArray(raw)) {
    throw new HttpError(`${context} must be an array`, 400);
  }

  const values: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const value = raw[index];
    if (typeof value !== 'string') {
      throw new HttpError(`${context}[${index}] must be a string`, 400);
    }
    values.push(value);
  }

  return values;
}

function parseInvitation(raw: unknown, context: string): Invitation {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }

  assertAllowedKeys(raw, ['id', 'name', 'guestIds', 'visitedAt'], context);

  return {
    id: parseRequiredString(raw, 'id', context),
    name: parseRequiredString(raw, 'name', context),
    guestIds: parseStringArray(raw.guestIds, `${context}.guestIds`),
    visitedAt: parseStringArray(raw.visitedAt, `${context}.visitedAt`)
  };
}

function parseGuest(raw: unknown, context: string): Guest {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }
  assertAllowedKeys(raw, ['id', 'name', 'checked', 'updatedAt', 'allergies', 'invitationId'], context);
  const base = parseBaseItem(raw, context);
  return {
    ...base,
    allergies: parseOptionalString(raw, 'allergies', context),
    invitationId: parseOptionalString(raw, 'invitationId', context)
  };
}

function parseCake(raw: unknown, context: string): Cake {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }
  assertAllowedKeys(raw, ['id', 'name', 'checked', 'updatedAt', 'servings', 'bakerName'], context);
  const base = parseBaseItem(raw, context);
  const servings = raw.servings;
  if (typeof servings !== 'number' || !Number.isFinite(servings)) {
    throw new HttpError(`${context}.servings must be a number`, 400);
  }
  return {
    ...base,
    servings,
    bakerName: parseOptionalString(raw, 'bakerName', context)
  };
}

export function parseState(input: unknown): AppState {
  if (!isRecord(input)) {
    throw new HttpError('State must be an object', 400);
  }

  assertAllowedKeys(input, ['gifts', 'guests', 'cakes', 'invitations'], 'state');

  const giftsRaw = input.gifts;
  const guestsRaw = input.guests;
  const cakesRaw = input.cakes;
  const invitationsRaw = input.invitations;

  if (!Array.isArray(giftsRaw)) {
    throw new HttpError('state.gifts must be an array', 400);
  }
  if (!Array.isArray(guestsRaw)) {
    throw new HttpError('state.guests must be an array', 400);
  }
  if (!Array.isArray(cakesRaw)) {
    throw new HttpError('state.cakes must be an array', 400);
  }
  if (!Array.isArray(invitationsRaw)) {
    throw new HttpError('state.invitations must be an array', 400);
  }

  return {
    gifts: giftsRaw.map((entry, index) => parseGift(entry, `state.gifts[${index}]`)),
    guests: guestsRaw.map((entry, index) => parseGuest(entry, `state.guests[${index}]`)),
    cakes: cakesRaw.map((entry, index) => parseCake(entry, `state.cakes[${index}]`)),
    invitations: invitationsRaw.map((entry, index) => parseInvitation(entry, `state.invitations[${index}]`))
  };
}

export function parseAddBody(body: unknown): { name: string } {
  if (!isRecord(body)) {
    throw new HttpError('Request body must be an object', 400);
  }
  assertAllowedKeys(body, ['name'], 'body');
  return { name: parseRequiredString(body, 'name', 'body').trim() };
}

export function parseCheckedBody(
  list: ListName,
  body: unknown
): { id: string; value: string; field: 'gifterName' | 'bakerName' | 'allergies' } {
  if (!isRecord(body)) {
    throw new HttpError('Request body must be an object', 400);
  }
  const field = requiredCheckField(list);
  assertAllowedKeys(body, ['id', field], 'body');

  const id = parseRequiredString(body, 'id', 'body');
  const rawValue = body[field];
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw new HttpError(`body.${field} must be a non-empty string`, 400);
  }

  return { id, value: rawValue.trim(), field };
}

export function parseUncheckedBody(body: unknown): { id: string } {
  if (!isRecord(body)) {
    throw new HttpError('Request body must be an object', 400);
  }
  assertAllowedKeys(body, ['id'], 'body');
  return { id: parseRequiredString(body, 'id', 'body') };
}

export function parseGuestNotesBody(
  body: unknown
): { id: string; value: string; completed: boolean } {
  if (!isRecord(body)) {
    throw new HttpError('Request body must be an object', 400);
  }

  assertAllowedKeys(body, ['id', 'allergies', 'completed'], 'body');

  const id = parseRequiredString(body, 'id', 'body');
  const rawValue = body.allergies;
  if (typeof rawValue !== 'string') {
    throw new HttpError('body.allergies must be a string', 400);
  }

  const rawCompleted = body.completed;
  if (rawCompleted !== undefined && typeof rawCompleted !== 'boolean') {
    throw new HttpError('body.completed must be a boolean when provided', 400);
  }

  return {
    id,
    value: rawValue,
    completed: rawCompleted === true
  };
}

export function createStateStore(storageDir: string) {
  const listFiles: Record<ListName, string> = {
    gifts: path.join(storageDir, listFileNames.gifts),
    guests: path.join(storageDir, listFileNames.guests),
    cakes: path.join(storageDir, listFileNames.cakes),
    invitations: path.join(storageDir, listFileNames.invitations),
  };

  const changeLogFile = path.join(storageDir, changeLogFileName);

  async function exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function writeListFile<T>(filePath: string, list: T[]): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  async function readJsonFile(filePath: string, label: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf8');
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`${label} contains invalid JSON`);
    }
  }

  async function ensureStateFileExists(): Promise<void> {
    await fs.mkdir(storageDir, { recursive: true });

    if (!(await exists(listFiles.gifts))) {
      await writeListFile(listFiles.gifts, defaultState.gifts);
    }
    if (!(await exists(listFiles.guests))) {
      await writeListFile(listFiles.guests, defaultState.guests);
    }
    if (!(await exists(listFiles.cakes))) {
      await writeListFile(listFiles.cakes, defaultState.cakes);
    }
    if (!(await exists(listFiles.invitations))) {
      await writeListFile(listFiles.invitations, defaultState.invitations);
    }
    if (!(await exists(changeLogFile))) {
      await fs.writeFile(changeLogFile, '', 'utf8');
    }
  }

  async function readState(): Promise<AppState> {
    await ensureStateFileExists();

    const giftsRaw = await readJsonFile(listFiles.gifts, 'gifts.json');
    const guestsRaw = await readJsonFile(listFiles.guests, 'guests.json');
    const cakesRaw = await readJsonFile(listFiles.cakes, 'cakes.json');
    const invitationsRaw = await readJsonFile(listFiles.invitations, 'invitations.json');

    if (!Array.isArray(giftsRaw)) {
      throw new HttpError('gifts.json must contain an array', 400);
    }
    if (!Array.isArray(guestsRaw)) {
      throw new HttpError('guests.json must contain an array', 400);
    }
    if (!Array.isArray(cakesRaw)) {
      throw new HttpError('cakes.json must contain an array', 400);
    }
    if (!Array.isArray(invitationsRaw)) {
      throw new HttpError('invitations.json must contain an array', 400);
    }

    return {
      gifts: giftsRaw.map((entry, index) => parseGift(entry, `gifts[${index}]`)),
      guests: guestsRaw.map((entry, index) => parseGuest(entry, `guests[${index}]`)),
      cakes: cakesRaw.map((entry, index) => parseCake(entry, `cakes[${index}]`)),
      invitations: invitationsRaw.map((entry, index) => parseInvitation(entry, `invitations[${index}]`))
    };
  }

  async function writeState(state: AppState): Promise<void> {
    parseState(state);
    await ensureStateFileExists();
    await writeListFile(listFiles.gifts, state.gifts);
    await writeListFile(listFiles.guests, state.guests);
    await writeListFile(listFiles.cakes, state.cakes);
    await writeListFile(listFiles.invitations, state.invitations);
  }

  async function appendStateChangeLog(update: DeltaUpdate, state: AppState): Promise<void> {
    await ensureStateFileExists();

    const entry = {
      timestamp: nowIso(),
      update,
      totals: {
        gifts: state.gifts.length,
        guests: state.guests.length,
        cakes: state.cakes.length,
        invitations: state.invitations.length
      }
    };

    await fs.appendFile(changeLogFile, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  return {
    ensureStateFileExists,
    readState,
    writeState,
    appendStateChangeLog
  };
}

export function requiredCheckField(list: ListName): 'gifterName' | 'bakerName' | 'allergies' {
  if (list === 'gifts') return 'gifterName';
  if (list === 'cakes') return 'bakerName';
  return 'allergies';
}

export function addItem(state: AppState, list: ListName, name: string): DeltaUpdate {
  const base: BaseItem = {
    id: makeId(),
    name,
    checked: false,
    updatedAt: nowIso()
  };

  let item: ListEntity;
  if (list === 'gifts') item = { ...base };
  else if (list === 'guests') item = { ...base };
  else item = { ...base, servings: 0 };

  state[list].push(item as never);
  return { type: 'item-added', list, item };
}

export function checkItem(state: AppState, list: ListName, id: string, value: string): DeltaUpdate | null {
  if (list === 'gifts') {
    const item = state.gifts.find((entry) => entry.id === id);
    if (!item) return null;
    item.checked = true;
    item.updatedAt = nowIso();
    item.gifterName = value;
    return { type: 'item-checked', list, item };
  }

  if (list === 'guests') {
    const item = state.guests.find((entry) => entry.id === id);
    if (!item) return null;
    item.checked = true;
    item.updatedAt = nowIso();
    item.allergies = value;
    return { type: 'item-checked', list, item };
  }

  const item = state.cakes.find((entry) => entry.id === id);
  if (!item) return null;
  item.checked = true;
  item.updatedAt = nowIso();
  item.bakerName = value;
  return { type: 'item-checked', list, item };
}

export function uncheckItem(state: AppState, list: ListName, id: string): DeltaUpdate | null {
  if (list === 'gifts') {
    const item = state.gifts.find((entry) => entry.id === id);
    if (!item) return null;
    item.checked = false;
    item.updatedAt = nowIso();
    delete item.gifterName;
    return { type: 'item-unchecked', list, item };
  }

  if (list === 'guests') {
    const item = state.guests.find((entry) => entry.id === id);
    if (!item) return null;
    item.checked = false;
    item.updatedAt = nowIso();
    return { type: 'item-unchecked', list, item };
  }

  const item = state.cakes.find((entry) => entry.id === id);
  if (!item) return null;
  item.checked = false;
  item.updatedAt = nowIso();
  delete item.bakerName;
  return { type: 'item-unchecked', list, item };
}

export function updateGuestNotes(
  state: AppState,
  id: string,
  notes: string
): DeltaUpdate | null {
  const item = state.guests.find((entry) => entry.id === id);
  if (!item) return null;

  item.allergies = notes;
  item.updatedAt = nowIso();
  return { type: 'item-checked', list: 'guests', item };
}

export function isListName(value: string): value is ListName {
  return validLists.has(value as ListName);
}

export function markInvitationVisited(invitation: Invitation): Invitation {
  invitation.visitedAt = [...invitation.visitedAt, nowIso()];
  return invitation;
}