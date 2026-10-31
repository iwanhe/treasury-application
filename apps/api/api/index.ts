import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/main';

let appPromise: Promise<INestApplication> | undefined;

async function getHandler() {
  appPromise ??= (async () => {
    const app = await createApp();
    await app.init();
    return app;
  })();
  const app = await appPromise;
  return app.getHttpAdapter().getInstance() as (
    req: IncomingMessage,
    res: ServerResponse
  ) => void;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const express = await getHandler();
    return express(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('Treasury API initialization failed', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ statusCode: 500, message: 'API initialization failed' }));
  }
}
