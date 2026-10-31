import type { VercelRequest, VercelResponse } from '@vercel/node';
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
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const express = await getHandler();
    return express(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('Treasury API initialization failed', error);
    return res.status(500).json({ statusCode: 500, message: 'API initialization failed' });
  }
}
