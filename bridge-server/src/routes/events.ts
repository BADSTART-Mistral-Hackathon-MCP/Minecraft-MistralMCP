import { Router } from 'express';
import { bus } from '../services/bus';

export function createEventsRoutes(): Router {
  const router = Router();

  router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Simple listeners
    const onSay = (d: any) => send('dm_say', d);
    const onStart = (d: any) => send('quest_started', d);
    const onSucc = (d: any) => send('quest_succeeded', d);
    const onFail = (d: any) => send('quest_failed', d);
    const onUpd = (d: any) => send('quest_updated', d);

    bus.on('dm_say', onSay);
    bus.on('quest_started', onStart);
    bus.on('quest_succeeded', onSucc);
    bus.on('quest_failed', onFail);
    bus.on('quest_updated', onUpd);

    req.on('close', () => {
      bus.off('dm_say', onSay);
      bus.off('quest_started', onStart);
      bus.off('quest_succeeded', onSucc);
      bus.off('quest_failed', onFail);
      bus.off('quest_updated', onUpd);
      res.end();
    });
  });

  return router;
}

export default createEventsRoutes;

