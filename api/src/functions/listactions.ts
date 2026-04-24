import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  addItem,
  checkItem,
  getPubSubClient,
  readState,
  type ListName,
  uncheckItem,
  writeState,
} from '../lib/state.js';

const validLists: ListName[] = ['gifts', 'guests', 'cakes'];

function parseList(value: string | undefined): ListName | null {
  if (!value) return null;
  if (validLists.includes(value as ListName)) return value as ListName;
  return null;
}

function requiredCheckField(list: ListName): string {
  if (list === 'gifts') return 'gifterName';
  if (list === 'cakes') return 'bakerName';
  return 'allergies';
}

app.http('listactions', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'lists/{list}/{action}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const list = parseList(req.params.list);
    const action = req.params.action;

    if (!list) {
      return { status: 400, jsonBody: { error: 'Invalid list name' } };
    }

    if (!action || !['add', 'checked', 'unchecked'].includes(action)) {
      return { status: 400, jsonBody: { error: 'Invalid action' } };
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const state = await readState();

    let update = null;

    if (action === 'add') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return { status: 400, jsonBody: { error: 'name is required' } };
      }
      update = addItem(state, list, name);
    }

    if (action === 'checked') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) {
        return { status: 400, jsonBody: { error: 'id is required' } };
      }

      const checkField = requiredCheckField(list);
      const rawValue = body[checkField];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!value) {
        return { status: 400, jsonBody: { error: `${checkField} is required` } };
      }

      update = checkItem(state, list, id, value);
      if (!update) {
        return { status: 404, jsonBody: { error: 'Item not found' } };
      }
    }

    if (action === 'unchecked') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) {
        return { status: 400, jsonBody: { error: 'id is required' } };
      }

      update = uncheckItem(state, list, id);
      if (!update) {
        return { status: 404, jsonBody: { error: 'Item not found' } };
      }
    }

    if (!update) {
      return { status: 400, jsonBody: { error: 'No update produced' } };
    }

    await writeState(state);

    const pubsubClient = getPubSubClient();
    await pubsubClient.sendToAll(update);

    return { status: 200, jsonBody: { update } };
  },
});
