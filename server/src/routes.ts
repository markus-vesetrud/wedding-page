import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { HttpError } from './errors.js';
import {
  addItem,
  anonymizeGifters,
  bulkAddItems,
  createInvitationWithGuests,
  finalizeItemUpdate,
  findInvitationPlusOne,
  isListName,
  markInvitationVisited,
  parseAddBody,
  parseBulkAddBody,
  parseCreateInvitationBody,
  parseItemUpdateBody,
  parsePlusOneBody,
  promoteCakeSuggestion,
  setInvitationPlusOne
} from './state.js';
import type { AppState, Guest, ListName, WsDeltaType, WsDeltaUpdate } from '../../shared/types.js';
import { generateInvitationPdf, isInvitationPdfLayout } from './pdf/invitation.js';
import { isQrErrorCorrectionLevel } from './pdf/qr.js';

export interface RouteDependencies {
  publicDir: string;
  adminPassword: string | undefined;
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

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!deps.adminPassword) {
      res.status(503).json({ error: 'Admin access is not configured' });
      return;
    }
    if (req.get('x-admin-password') !== deps.adminPassword) {
      res.status(401).json({ error: 'Invalid admin password' });
      return;
    }
    next();
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

        return { invitation, guests, plusOne: findInvitationPlusOne(state, invitation) };
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

  app.post('/api/invitations/:id/plus-one', async (req: Request<{ id: string }>, res: Response) => {
    const id = decodeURIComponent(req.params.id);

    try {
      const payload = await withMutationLock(async () => {
        const body = parsePlusOneBody(req.body);
        const state = await deps.readState();
        const invitation = state.invitations.find((invitation) => invitation.id === id);
        if (!invitation) {
          throw new HttpError('Invitation not found', 404);
        }
        if (invitation.plusOneText === null) {
          throw new HttpError('Invitation does not include a plus-one', 400);
        }

        const update = setInvitationPlusOne(state, invitation, body);
        await deps.writeState(state);
        if (update) {
          await deps.appendStateChangeLog(update, state);
          deps.broadcastJson(update);
        }

        return { plusOne: findInvitationPlusOne(state, invitation) };
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

  app.get('/api/invitations/:id/pdf', async (req: Request<{ id: string }>, res: Response) => {
    const id = decodeURIComponent(req.params.id);

    const eccParam = typeof req.query.ecc === 'string' ? req.query.ecc.toUpperCase() : 'L';
    if (!isQrErrorCorrectionLevel(eccParam)) {
      res.status(400).json({ error: 'ecc must be one of L, M, Q, H' });
      return;
    }

    const layoutParam = typeof req.query.layout === 'string' ? req.query.layout.toLowerCase() : 'a5';
    if (!isInvitationPdfLayout(layoutParam)) {
      res.status(400).json({ error: 'layout must be a5 or a4' });
      return;
    }

    try {
      const state = await deps.readState();
      const invitation = state.invitations.find((invitation) => invitation.id === id);
      if (!invitation) {
        res.status(404).json({ error: 'Invitation not found' });
        return;
      }

      const host = req.get('host');
      if (!host) {
        res.status(500).json({ error: 'Host header is required' });
        return;
      }
      const protocol = req.get('x-forwarded-proto') ?? req.protocol;
      const qrTargetUrl = `${protocol}://${host}/invitasjon/${encodeURIComponent(invitation.id)}`;

      const bytes = await generateInvitationPdf({
        invitationName: invitation.name,
        // Matches the invitation page, which says "dere" for more than one guest
        plural: invitation.guestIds.filter((guestId) => state.guests.some((guest) => guest.id === guestId)).length > 1,
        qrTargetUrl,
        qrErrorCorrectionLevel: eccParam,
        layout: layoutParam
      });

      res.writeHead(200, {
        'Content-disposition': `attachment; filename="Bryllupsinvitasjon${layoutParam === 'a4' ? '-A4' : ''}.pdf"`,
        'Content-type': 'application/pdf',
        'Content-length': bytes.length
      });
      res.end(Buffer.from(bytes));
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.get('/api/admin/cake-suggestions', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const state = await deps.readState();
      res.json({ suggestions: state.cakeSuggestions });
    } catch {
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.get('/api/admin/lists', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const state = await deps.readState();
      res.json(anonymizeGifters(state));
    } catch {
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.post('/api/admin/invitations', requireAdmin, async (req: Request, res: Response) => {
    try {
      const invitation = await withMutationLock(async () => {
        const { name, guestNames, plusOneText, titulation, ageNotice } = parseCreateInvitationBody(req.body);
        const state = await deps.readState();
        const created = createInvitationWithGuests(state, name, guestNames, { plusOneText, titulation, ageNotice });
        await deps.writeState(state);
        return created;
      });

      res.json({ invitation });
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.post('/api/admin/bulk-add/:list', requireAdmin, async (req: Request<{ list: string }>, res: Response) => {
    const list = req.params.list;
    if (list !== 'gifts' && list !== 'cakes') {
      res.status(400).json({ error: 'Bulk add is only supported for gifts and cakes' });
      return;
    }

    try {
      const items = await withMutationLock(async () => {
        const { names } = parseBulkAddBody(req.body);
        const state = await deps.readState();
        const created = bulkAddItems(state, list, names);
        await deps.writeState(state);

        for (const item of created) {
          const update: WsDeltaUpdate = { type: 'add', list, item };
          await deps.appendStateChangeLog(update, state);
          deps.broadcastJson(update);
        }

        return created;
      });

      res.json({ items });
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.post('/api/admin/cake-suggestions/:id/promote', requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const cake = await withMutationLock(async () => {
        const state = await deps.readState();
        const promoted = promoteCakeSuggestion(state, req.params.id);
        if (!promoted) {
          throw new HttpError('Suggestion not found', 404);
        }
        await deps.writeState(state);
        const update: WsDeltaUpdate = { type: 'add', list: 'cakes', item: promoted };
        await deps.appendStateChangeLog(update, state);
        deps.broadcastJson(update);
        return promoted;
      });

      res.json({ cake });
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Unexpected error' });
    }
  });

  app.post('/api/:action/:list', async (req: Request<{ list: ListName; action: WsDeltaType }>, res: Response) => {
    const listParam = req.params.list;
    const action = req.params.action;

    if (!isListName(listParam)) {
      res.status(400).json({ error: 'Invalid list name' });
      return;
    }

    const list = listParam;

    if (!['add', 'update'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    try {
      const update = await withMutationLock(async () => {
        const state = await deps.readState();
        let result: WsDeltaUpdate | null = null;

        if (action === 'add') {
          const addBody = parseAddBody(list, req.body);
          result = addItem(state, list, addBody);
        }

        if (action === 'update') {
          const { id, patch } = parseItemUpdateBody(list, req.body);
          result = finalizeItemUpdate(state, list, id, patch);
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

      if (list !== 'cakeSuggestions') {
        deps.broadcastJson(update);
      }
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