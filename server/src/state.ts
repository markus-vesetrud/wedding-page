import path from 'node:path';
import { promises as fs } from 'node:fs';
import { HttpError } from './errors.js';
import {
  AppState,
  Attendance,
  Item,
  Cake,
  WsDeltaUpdate,
  Gift,
  Guest,
  Invitation,
  ListEntity,
  ListName
} from '../../shared/types.js';

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

function parseBaseItem(raw: unknown, context: string): Item {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }

  return {
    id: parseRequiredString(raw, 'id', context),
    name: parseRequiredString(raw, 'name', context),
    updatedAt: parseRequiredString(raw, 'updatedAt', context)
  };
}

function isAttendance(value: unknown): value is Attendance {
  return value === 'Kommer' || value === 'Kommer ikke' || value === 'Usikker';
}

function parseGift(raw: unknown, context: string): Gift {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }
  assertAllowedKeys(raw, ['id', 'name', 'claimed', 'updatedAt', 'gifterName'], context);
  const base = parseBaseItem(raw, context);
  const claimed = parseRequiredBoolean(raw, 'claimed', context);
  return {
    ...base,
    claimed,
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
  assertAllowedKeys(raw, ['id', 'name', 'attendance', 'updatedAt', 'allergies', 'invitationId'], context);
  const base = parseBaseItem(raw, context);
  const attendanceRaw = raw.attendance;
  if (!isAttendance(attendanceRaw)) {
    throw new HttpError(`${context}.attendance must be one of Kommer, Kommer ikke, Usikker`, 400);
  }
  return {
    ...base,
    attendance: attendanceRaw,
    allergies: parseOptionalString(raw, 'allergies', context),
    invitationId: parseOptionalString(raw, 'invitationId', context)
  };
}

function parseCake(raw: unknown, context: string): Cake {
  if (!isRecord(raw)) {
    throw new HttpError(`${context} must be an object`, 400);
  }
  assertAllowedKeys(raw, ['id', 'name', 'claimed', 'updatedAt', 'servings', 'bakerName'], context);
  const base = parseBaseItem(raw, context);
  const claimed = parseRequiredBoolean(raw, 'claimed', context);
  const servings = raw.servings;
  if (typeof servings !== 'number' || !Number.isFinite(servings)) {
    throw new HttpError(`${context}.servings must be a number`, 400);
  }
  return {
    ...base,
    claimed,
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

export function parseItemUpdateBody(
  list: ListName,
  body: unknown
): { id: string; patch: Record<string, unknown> } {
  if (!isRecord(body)) {
    throw new HttpError('Request body must be an object', 400);
  }

  const id = parseRequiredString(body, 'id', 'body');

  const patch = body.patch;
  if (!isRecord(patch)) {
    throw new HttpError('body.patch must be an object', 400);
  }

  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw new HttpError('body.patch must contain at least one field', 400);
  }

  if (list === 'gifts') {
    assertAllowedKeys(patch, ['name', 'claimed', 'gifterName'], 'body.patch');
    if (patch.name !== undefined && (typeof patch.name !== 'string' || !patch.name.trim())) {
      throw new HttpError('body.patch.name must be a non-empty string', 400);
    }
    if (patch.claimed !== undefined && typeof patch.claimed !== 'boolean') {
      throw new HttpError('body.patch.claimed must be a boolean', 400);
    }
    if (patch.gifterName !== undefined && typeof patch.gifterName !== 'string') {
      throw new HttpError('body.patch.gifterName must be a string', 400);
    }
  } else if (list === 'cakes') {
    assertAllowedKeys(patch, ['name', 'claimed', 'bakerName', 'servings'], 'body.patch');
    if (patch.name !== undefined && (typeof patch.name !== 'string' || !patch.name.trim())) {
      throw new HttpError('body.patch.name must be a non-empty string', 400);
    }
    if (patch.claimed !== undefined && typeof patch.claimed !== 'boolean') {
      throw new HttpError('body.patch.claimed must be a boolean', 400);
    }
    if (patch.bakerName !== undefined && typeof patch.bakerName !== 'string') {
      throw new HttpError('body.patch.bakerName must be a string', 400);
    }
    if (patch.servings !== undefined && (typeof patch.servings !== 'number' || !Number.isFinite(patch.servings))) {
      throw new HttpError('body.patch.servings must be a number', 400);
    }
  } else if (list === 'guests') {
    assertAllowedKeys(patch, ['name', 'attendance', 'allergies', 'invitationId'], 'body.patch');
    if (patch.name !== undefined && (typeof patch.name !== 'string' || !patch.name.trim())) {
      throw new HttpError('body.patch.name must be a non-empty string', 400);
    }
    if (patch.attendance !== undefined && !isAttendance(patch.attendance)) {
      throw new HttpError('body.patch.attendance must be one of Kommer, Kommer ikke, Usikker', 400);
    }
    if (patch.allergies !== undefined && typeof patch.allergies !== 'string') {
      throw new HttpError('body.patch.allergies must be a string', 400);
    }
    if (patch.invitationId !== undefined && typeof patch.invitationId !== 'string') {
      throw new HttpError('body.patch.invitationId must be a string', 400);
    }
  } else {
    throw new HttpError('Updates are only supported for gifts, cakes and guests', 400);
  }

  return { id, patch: { ...patch } };
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

  async function ensureStateFilesExists(): Promise<void> {
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
    await ensureStateFilesExists();

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

    const migratedGifts = parseLegacyAwareListEntries(giftsRaw, 'gifts');
    const migratedGuests = parseLegacyAwareListEntries(guestsRaw, 'guests');
    const migratedCakes = parseLegacyAwareListEntries(cakesRaw, 'cakes');

    const state: AppState = {
      gifts: migratedGifts.map((entry, index) => parseGift(entry, `gifts[${index}]`)),
      guests: migratedGuests.map((entry, index) => parseGuest(entry, `guests[${index}]`)),
      cakes: migratedCakes.map((entry, index) => parseCake(entry, `cakes[${index}]`)),
      invitations: invitationsRaw.map((entry, index) => parseInvitation(entry, `invitations[${index}]`))
    };

    normalizeLegacyState(state);
    writeState(state);
    return state;
  }

  async function writeState(state: AppState): Promise<void> {
    parseState(state);
    await ensureStateFilesExists();
    await writeListFile(listFiles.gifts, state.gifts);
    await writeListFile(listFiles.guests, state.guests);
    await writeListFile(listFiles.cakes, state.cakes);
    await writeListFile(listFiles.invitations, state.invitations);
  }

  async function appendStateChangeLog(update: WsDeltaUpdate, state: AppState): Promise<void> {
    await ensureStateFilesExists();

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
    ensureStateFileExists: ensureStateFilesExists,
    readState,
    writeState,
    appendStateChangeLog
  };
}

export function addItem(state: AppState, list: ListName, name: string): WsDeltaUpdate {
  const base: Item = {
    id: makeId(),
    name,
    updatedAt: nowIso()
  };

  let item: ListEntity;
  if (list === 'gifts') item = { ...base, claimed: false };
  else if (list === 'guests') item = { ...base, attendance: Attendance.Unsure };
  else item = { ...base, claimed: false, servings: 0 };

  state[list].push(item as never);
  return { type: 'add', list, item };
}

export function updateItem(
  state: AppState,
  list: ListName,
  id: string,
  patch: Record<string, unknown>
): WsDeltaUpdate | null {
  if (list === 'gifts') {
    const item = state.gifts.find((entry) => entry.id === id);
    if (!item) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) item.name = patch.name.trim();
    if (typeof patch.claimed === 'boolean') item.claimed = patch.claimed;
    if (typeof patch.gifterName === 'string') {
      const value = patch.gifterName.trim();
      if (value) item.gifterName = value;
      else delete item.gifterName;
    }
    item.updatedAt = nowIso();
    return { type: 'update', list, item };
  }

  if (list === 'guests') {
    const item = state.guests.find((entry) => entry.id === id);
    if (!item) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) item.name = patch.name.trim();
    if (isAttendance(patch.attendance)) item.attendance = patch.attendance;
    if (typeof patch.allergies === 'string') item.allergies = patch.allergies;
    if (typeof patch.invitationId === 'string') item.invitationId = patch.invitationId;
    item.updatedAt = nowIso();
    return { type: 'update', list, item };
  }

  if (list === 'cakes') {
    const item = state.cakes.find((entry) => entry.id === id);
    if (!item) return null;
    if (typeof patch.name === 'string' && patch.name.trim()) item.name = patch.name.trim();
    if (typeof patch.claimed === 'boolean') item.claimed = patch.claimed;
    if (typeof patch.bakerName === 'string') {
      const value = patch.bakerName.trim();
      if (value) item.bakerName = value;
      else delete item.bakerName;
    }
    if (typeof patch.servings === 'number' && Number.isFinite(patch.servings)) {
      item.servings = patch.servings;
    }
    item.updatedAt = nowIso();
    return { type: 'update', list, item };
  }

  return null;
}

export function normalizeLegacyState(state: AppState): void {
  for (const gift of state.gifts as Array<Gift & { checked?: boolean }>) {
    if ((gift as { claimed?: boolean }).claimed === undefined) {
      gift.claimed = Boolean(gift.checked);
    }
    delete gift.checked;
  }

  for (const cake of state.cakes as Array<Cake & { checked?: boolean }>) {
    if ((cake as { claimed?: boolean }).claimed === undefined) {
      cake.claimed = Boolean(cake.checked);
    }
    delete cake.checked;
  }

  for (const guest of state.guests as Array<Guest & { checked?: boolean }>) {
    if ((guest as { attendance?: Attendance }).attendance === undefined) {
      guest.attendance = guest.checked ? Attendance.Attending : Attendance.NotAttending;
    }
    delete guest.checked;
  }
}

export function migrateLegacyRecord(raw: unknown, list: 'gifts' | 'cakes' | 'guests'): unknown {
  if (!isRecord(raw)) return raw;

  if (list === 'gifts') {
    const output = { ...raw };
    if (!('claimed' in output) && 'checked' in output) {
      output.claimed = Boolean(output.checked);
    }
    delete output.checked;
    return output;
  }

  if (list === 'cakes') {
    const output = { ...raw };
    if (!('claimed' in output) && 'checked' in output) {
      output.claimed = Boolean(output.checked);
    }
    delete output.checked;
    return output;
  }

  const output = { ...raw };
  if (!('attendance' in output) && 'checked' in output) {
    output.attendance = output.checked ? 'Kommer' : 'Usikker';
  }
  delete output.checked;
  return output;
}

export function parseLegacyAwareListEntries(
  entries: unknown[],
  list: 'gifts' | 'cakes' | 'guests'
): unknown[] {
  return entries.map((entry) => migrateLegacyRecord(entry, list));
}

export function finalizeItemUpdate(
  state: AppState,
  list: ListName,
  id: string,
  patch: Record<string, unknown>
): WsDeltaUpdate | null {
  const update = updateItem(state, list, id, patch);
  if (!update) return null;
  return update;
}

export function isListName(value: string): value is ListName {
  return validLists.has(value as ListName);
}

export function markInvitationVisited(invitation: Invitation): Invitation {
  invitation.visitedAt = [...invitation.visitedAt, nowIso()];
  return invitation;
}