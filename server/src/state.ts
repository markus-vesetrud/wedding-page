import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { HttpError } from './errors.js';
import {
  AppState,
  Attendance,
  Item,
  Cake,
  CakeSuggestion,
  WsDeltaUpdate,
  Gift,
  Guest,
  Invitation,
  ListEntity,
  ListName,
  plusOneGuestId
} from '../../shared/types.js';

const defaultState: AppState = {
  gifts: [],
  guests: [],
  cakes: [],
  invitations: [],
  cakeSuggestions: []
};

const listFileNames: Record<ListName, string> = {
  gifts: 'gifts.json',
  guests: 'guests.json',
  cakes: 'cakes.json',
  invitations: 'invitations.json',
  cakeSuggestions: 'cake-suggestions.json'
};

const changeLogFileName = 'state-changes.log';

const validLists = new Set<ListName>(['gifts', 'guests', 'cakes', 'cakeSuggestions']);

function makeId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatZodError(error: z.ZodError, context: string): string {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? `${context}.${issue.path.join('.')}` : context;
  return `${path}: ${issue.message}`;
}

function parseWithSchema<T>(schema: z.ZodType<T>, raw: unknown, context: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(formatZodError(result.error, context), 400);
  }
  return result.data;
}

const ItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});

const GiftSchema = ItemSchema.extend({
  claimed: z.boolean(),
  gifterName: z.string().optional()
}).strict() satisfies z.ZodType<Gift>;

const CakeSuggestionSchema = ItemSchema.extend({
  bakerName: z.string().optional()
}).strict() satisfies z.ZodType<CakeSuggestion>;

const CakeSchema = CakeSuggestionSchema.extend({
  claimed: z.boolean()
}).strict() satisfies z.ZodType<Cake>;

const GuestSchema = ItemSchema.extend({
  attendance: z.nativeEnum(Attendance),
  allergies: z.string().optional(),
  invitationId: z.string().optional()
}).strict() satisfies z.ZodType<Guest>;

const InvitationSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    guestIds: z.array(z.string()),
    visitedAt: z.array(z.string()),
    plusOneText: z.string().nullable(),
    titulation: z.string().nullable()
  })
  .strict() satisfies z.ZodType<Invitation>;

const AppStateSchema = z
  .object({
    gifts: z.array(GiftSchema),
    guests: z.array(GuestSchema),
    cakes: z.array(CakeSchema),
    invitations: z.array(InvitationSchema),
    cakeSuggestions: z.array(CakeSuggestionSchema)
  })
  .strict() satisfies z.ZodType<AppState>;

const addBodySchemaByList: Partial<Record<ListName, z.ZodTypeAny>> = {
  gifts: z.object({ name: z.string().trim().min(1), gifterName: z.string().trim().min(1) }).strict(),
  cakes: z.object({ name: z.string().trim().min(1), bakerName: z.string().trim().min(1).optional() }).strict(),
  cakeSuggestions: z
    .object({ name: z.string().trim().min(1), bakerName: z.string().trim().min(1).optional() })
    .strict(),
  guests: z.object({ name: z.string().trim().min(1) }).strict()
};

const patchSchemaByList: Partial<Record<ListName, z.ZodTypeAny>> = {
  gifts: z
    .object({
      name: z.string().trim().min(1).optional(),
      claimed: z.boolean().optional(),
      gifterName: z.string().optional()
    })
    .strict(),
  cakes: z
    .object({
      name: z.string().trim().min(1).optional(),
      claimed: z.boolean().optional(),
      bakerName: z.string().optional()
    })
    .strict(),
  guests: z
    .object({
      name: z.string().trim().min(1).optional(),
      attendance: z.nativeEnum(Attendance).optional(),
      allergies: z.string().optional(),
      invitationId: z.string().optional()
    })
    .strict()
};

const CreateInvitationBodySchema = z
  .object({
    name: z.string().trim().min(1),
    guestNames: z.array(z.string().trim().min(1)).min(1),
    plusOneText: z.string().trim().nullable().optional(),
    titulation: z.string().trim().nullable().optional()
  })
  .strict();

const PlusOneBodySchema = z
  .object({
    attending: z.boolean(),
    name: z.string().trim(),
    allergies: z.string().optional()
  })
  .strict()
  .refine((body) => !body.attending || body.name.length > 0, {
    message: 'name is required when bringing a plus-one',
    path: ['name']
  });

export type PlusOneBody = z.infer<typeof PlusOneBodySchema>;

const BulkAddBodySchema = z
  .object({
    names: z.array(z.string().trim().min(1)).min(1)
  })
  .strict();

export function parseState(input: unknown): AppState {
  return parseWithSchema(AppStateSchema, input, 'state');
}

export function parseCreateInvitationBody(body: unknown): {
  name: string;
  guestNames: string[];
  plusOneText?: string | null;
  titulation?: string | null;
} {
  return parseWithSchema(CreateInvitationBodySchema, body, 'body');
}

export function parsePlusOneBody(body: unknown): PlusOneBody {
  return parseWithSchema(PlusOneBodySchema, body, 'body');
}

export function parseBulkAddBody(body: unknown): { names: string[] } {
  return parseWithSchema(BulkAddBodySchema, body, 'body');
}

export function parseAddBody(
  list: ListName,
  body: unknown
): { name: string; gifterName?: string; bakerName?: string } {
  const schema = addBodySchemaByList[list];
  if (!schema) {
    throw new HttpError(`Adding items is not supported for ${list}`, 400);
  }
  return parseWithSchema(schema, body, 'body') as {
    name: string;
    gifterName?: string;
    bakerName?: string;
  };
}

export function parseItemUpdateBody(
  list: ListName,
  body: unknown
): { id: string; patch: Record<string, unknown> } {
  const patchSchema = patchSchemaByList[list as keyof typeof patchSchemaByList];
  if (!patchSchema) {
    throw new HttpError('Updates are only supported for gifts, cakes and guests', 400);
  }

  const updateBodySchema = z.object({
    id: z.string().trim().min(1),
    patch: patchSchema.refine((patch) => Object.keys(patch as Record<string, unknown>).length > 0, {
      message: 'must contain at least one field'
    })
  });

  return parseWithSchema(updateBodySchema, body, 'body') as {
    id: string;
    patch: Record<string, unknown>;
  };
}

export function createStateStore(storageDir: string) {
  const listFiles: Record<ListName, string> = {
    gifts: path.join(storageDir, listFileNames.gifts),
    guests: path.join(storageDir, listFileNames.guests),
    cakes: path.join(storageDir, listFileNames.cakes),
    invitations: path.join(storageDir, listFileNames.invitations),
    cakeSuggestions: path.join(storageDir, listFileNames.cakeSuggestions)
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
    if (!(await exists(listFiles.cakeSuggestions))) {
      await writeListFile(listFiles.cakeSuggestions, defaultState.cakeSuggestions);
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
    const cakeSuggestionsRaw = await readJsonFile(listFiles.cakeSuggestions, 'cake-suggestions.json');

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
    if (!Array.isArray(cakeSuggestionsRaw)) {
      throw new HttpError('cake-suggestions.json must contain an array', 400);
    }

    const migratedGifts = parseLegacyAwareListEntries(giftsRaw, 'gifts');
    const migratedGuests = parseLegacyAwareListEntries(guestsRaw, 'guests');
    const migratedCakes = parseLegacyAwareListEntries(cakesRaw, 'cakes');
    const migratedInvitations = invitationsRaw.map(migrateLegacyInvitation);

    const state: AppState = {
      gifts: parseWithSchema(z.array(GiftSchema), migratedGifts, 'gifts'),
      guests: parseWithSchema(z.array(GuestSchema), migratedGuests, 'guests'),
      cakes: parseWithSchema(z.array(CakeSchema), migratedCakes, 'cakes'),
      invitations: parseWithSchema(z.array(InvitationSchema), migratedInvitations, 'invitations'),
      cakeSuggestions: parseWithSchema(z.array(CakeSuggestionSchema), cakeSuggestionsRaw, 'cakeSuggestions')
    };

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
    await writeListFile(listFiles.cakeSuggestions, state.cakeSuggestions);
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
        invitations: state.invitations.length,
        cakeSuggestions: state.cakeSuggestions.length
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

export function addItem(
  state: AppState,
  list: ListName,
  input: { name: string; gifterName?: string; bakerName?: string }
): WsDeltaUpdate {
  const base: Item = {
    id: makeId(),
    name: input.name,
    updatedAt: nowIso()
  };

  let item: ListEntity;
  if (list === 'gifts') {
    item = { ...base, claimed: Boolean(input.gifterName), gifterName: input.gifterName };
  } else if (list === 'guests') {
    item = { ...base, attendance: Attendance.NotAnswered };
  } else if (list === 'cakeSuggestions') {
    item = { ...base, bakerName: input.bakerName };
  } else {
    item = { ...base, claimed: Boolean(input.bakerName), bakerName: input.bakerName };
  }

  state[list].push(item as never);
  return { type: 'add', list, item };
}

export function promoteCakeSuggestion(state: AppState, suggestionId: string): Cake | null {
  const index = state.cakeSuggestions.findIndex((entry) => entry.id === suggestionId);
  if (index === -1) return null;

  const [suggestion] = state.cakeSuggestions.splice(index, 1);
  const cake: Cake = {
    id: makeId(),
    name: suggestion.name,
    bakerName: suggestion.bakerName,
    updatedAt: nowIso(),
    claimed: Boolean(suggestion.bakerName)
  };
  state.cakes.push(cake);
  return cake;
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
    if (typeof patch.attendance === 'string' && Object.values(Attendance).includes(patch.attendance as Attendance)) {
      item.attendance = patch.attendance as Attendance;
    }
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
    item.updatedAt = nowIso();
    return { type: 'update', list, item };
  }

  return null;
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
  if (output.isPlusOne === true && typeof output.invitationId === 'string') {
    output.id = plusOneGuestId(output.invitationId);
  }
  delete output.isPlusOne;
  if (!('attendance' in output) && 'checked' in output) {
    output.attendance = output.checked ? 'Kommer' : 'Ikke svart';
  }
  delete output.checked;
  return output;
}

export function migrateLegacyInvitation(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return { plusOneText: null, titulation: null, ...raw };
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

export function createInvitationWithGuests(
  state: AppState,
  invitationName: string,
  guestNames: string[],
  options: { plusOneText?: string | null; titulation?: string | null } = {}
): Invitation {
  const invitation: Invitation = {
    id: makeId(),
    name: invitationName,
    guestIds: [],
    visitedAt: [],
    plusOneText: options.plusOneText?.trim() || null,
    titulation: options.titulation?.trim() || null
  };

  for (const guestName of guestNames) {
    const guest: Guest = {
      id: makeId(),
      name: guestName,
      updatedAt: nowIso(),
      attendance: Attendance.NotAnswered,
      invitationId: invitation.id
    };
    state.guests.push(guest);
    invitation.guestIds.push(guest.id);
  }

  state.invitations.push(invitation);
  return invitation;
}

export function findInvitationPlusOne(state: AppState, invitation: Invitation): Guest | null {
  const id = plusOneGuestId(invitation.id);
  return state.guests.find((guest) => guest.id === id) ?? null;
}

/**
 * Creates or updates the invitation's plus-one guest. Saying no keeps the name and allergies
 * but marks them as not attending, so switching back restores them.
 * Returns the delta to broadcast, or null when there was nothing to change.
 */
export function setInvitationPlusOne(
  state: AppState,
  invitation: Invitation,
  body: PlusOneBody
): WsDeltaUpdate | null {
  const existing = findInvitationPlusOne(state, invitation);

  if (!body.attending) {
    if (!existing) return null;
    existing.attendance = Attendance.NotAttending;
    existing.updatedAt = nowIso();
    return { type: 'update', list: 'guests', item: existing };
  }

  if (existing) {
    existing.name = body.name;
    existing.attendance = Attendance.Attending;
    if (body.allergies !== undefined) existing.allergies = body.allergies;
    existing.updatedAt = nowIso();
    return { type: 'update', list: 'guests', item: existing };
  }

  const guest: Guest = {
    id: plusOneGuestId(invitation.id),
    name: body.name,
    updatedAt: nowIso(),
    attendance: Attendance.Attending,
    invitationId: invitation.id,
    allergies: body.allergies
  };
  state.guests.push(guest);
  return { type: 'add', list: 'guests', item: guest };
}

export function bulkAddItems(state: AppState, list: 'gifts' | 'cakes', names: string[]): (Gift | Cake)[] {
  const created: (Gift | Cake)[] = [];

  for (const name of names) {
    const item: Gift | Cake = {
      id: makeId(),
      name,
      updatedAt: nowIso(),
      claimed: false
    };
    state[list].push(item);
    created.push(item);
  }

  return created;
}

export function anonymizeGifters(state: AppState): { gifts: Gift[]; cakes: Cake[] } {
  const anonNameByRealName = new Map<string, string>();

  function anonymize(name: string): string {
    const key = name.trim().toLowerCase();
    let anon = anonNameByRealName.get(key);
    if (!anon) {
      anon = `Gjest ${anonNameByRealName.size + 1}`;
      anonNameByRealName.set(key, anon);
    }
    return anon;
  }

  const gifts = state.gifts.map((gift) =>
    gift.gifterName ? { ...gift, gifterName: anonymize(gift.gifterName) } : gift
  );

  return { gifts, cakes: state.cakes };
}