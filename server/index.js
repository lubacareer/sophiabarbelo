import express from 'express';
import path from 'node:path';
import { createApp } from './app.js';

const app = createApp();
const publicDir = path.resolve('dist');
app.use(express.static(publicDir));
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`Sophia's Mirror is available at http://${host}:${port}`));
