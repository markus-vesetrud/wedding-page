import express, { type Express, type Request, type Response } from 'express';
import path from 'node:path';
import { HttpError } from './errors.js';
import {
  addItem,
  checkItem,
  isListName,
  markInvitationVisited,
  parseAddBody,
  parseCheckedBody,
  parseGuestNotesBody,
  parseUncheckedBody,
  uncheckItem,
  updateGuestNotes
} from './state.js';
import type { AppState, Guest, WsDeltaUpdate } from '../../shared/types.js';

export interface RouteDependencies {
  publicDir: string;
  readState: () => Promise<AppState>;
  writeState: (state: AppState) => Promise<void>;
  appendStateChangeLog: (
    update: WsDeltaUpdate,
    state: AppState
  ) => Promise<void>;
  broadcastJson: (message: WsDeltaUpdate) => void;
}

export function registerRoutes(app: Express, deps: RouteDependencies): void {
  app.use(express.json());

  let mutationLock: Promise<unknown> = Promise.resolve();

  function withMutationLock<T>(work: () => Promise<T>): Promise<T> {
    const run = mutationLock.then(work, work);
    mutationLock = run.catch(() => undefined);
    return run;
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/negotiate', (req: Request, res: Response) => {
    const host = req.get('host');
    if (!host) {
      res.status(500).json({ error: 'Host header is required' });
      return;
    }

    const protoHeader = req.get('x-forwarded-proto');
    const protocol = protoHeader === 'https' ? 'wss' : req.protocol === 'https' ? 'wss' : 'ws';
    res.json({ url: `${protocol}://${host}/ws` });
  });

  app.get('/api/invitations/:id', async (req: Request<{ id: string }>, res: Response) => {
    const id = decodeURIComponent(req.params.id);

    try {
      const payload = await withMutationLock(async () => {
        const state = await deps.readState();
        let invitation = state.invitations.find((invitation) => invitation.id === id);
        if (!invitation) {
          throw new HttpError('Invitation not found', 404);
        }

        invitation = markInvitationVisited(invitation);

        await deps.writeState(state);

        const guests = invitation.guestIds
          .map((guestId) => state.guests.find((guest) => guest.id === guestId))
          .filter((guest): guest is Guest => Boolean(guest));

        return { invitation, guests };
      });

      res.json(payload);
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.post('/api/lists/:list/:action', async (req: Request<{ list: string; action: string }>, res: Response) => {
    const listParam = req.params.list;
    const action = req.params.action;

    if (!isListName(listParam)) {
      res.status(400).json({ error: 'Invalid list name' });
      return;
    }

    const list = listParam;

    if (!['add', 'checked', 'unchecked', 'notes'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    try {
      const update = await withMutationLock(async () => {
        const state = await deps.readState();
        let result: WsDeltaUpdate | null = null;

        if (action === 'add') {
          const { name } = parseAddBody(req.body);
          result = addItem(state, list, name);
        }

        if (action === 'checked') {
          const { id, value } = parseCheckedBody(list, req.body);

          result = checkItem(state, list, id, value);
          if (!result) {
            throw new HttpError('Item not found', 404);
          }
        }

        if (action === 'unchecked') {
          const { id } = parseUncheckedBody(req.body);

          result = uncheckItem(state, list, id);
          if (!result) {
            throw new HttpError('Item not found', 404);
          }
        }

        if (action === 'notes') {
          if (list !== 'guests') {
            throw new HttpError('Notes action is only supported for guests', 400);
          }

          const { id, value } = parseGuestNotesBody(req.body);
          result = updateGuestNotes(state, id, value);
          if (!result) {
            throw new HttpError('Item not found', 404);
          }
        }

        await deps.writeState(state);
        if (result) {
          await deps.appendStateChangeLog(result, state);
        }
        return result;
      });

      if (!update) {
        throw new HttpError('No update produced', 400);
      }

      deps.broadcastJson(update);
      res.json({ update });
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.use(express.static(deps.publicDir));

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(deps.publicDir, 'index.html'));
  });
}