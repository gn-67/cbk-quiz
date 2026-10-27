import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Phase } from '../../shared/protocol.ts';
import type { SessionManager } from './game/manager.ts';
import * as questionSets from './questionSets.ts';
import { ADMIN_PASSWORD, safeEqual } from './auth.ts';

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-admin-password');
  if (typeof header !== 'string' || !safeEqual(header, ADMIN_PASSWORD)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function errorStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number') {
    return err.status;
  }
  return 500;
}

export function createRouter(manager: SessionManager): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/sessions/:code/exists', (req, res) => {
    const code = String(req.params.code ?? '').trim();
    const session = manager.get(code);
    const phase: Phase = session ? session.phase : 'ended';
    res.json({ exists: Boolean(session), phase });
  });

  router.get('/question-sets', requireAdmin, (_req, res) => {
    res.json(questionSets.list());
  });

  router.post('/question-sets', requireAdmin, (req, res, next) => {
    try {
      res.status(201).json(questionSets.create(req.body));
    } catch (err) {
      next(err);
    }
  });

  router.put('/question-sets/:id', requireAdmin, (req, res, next) => {
    try {
      res.json(questionSets.update(String(req.params.id), req.body));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/question-sets/:id', requireAdmin, (req, res, next) => {
    try {
      questionSets.remove(String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = errorStatus(err);
    if (status >= 500) console.error('[api] unhandled error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(status).json({ error: status >= 500 ? 'Internal error' : message });
  });

  return router;
}
