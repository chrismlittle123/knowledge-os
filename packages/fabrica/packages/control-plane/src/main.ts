#!/usr/bin/env node
import { startServer } from './server.js';

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

startServer({ port, host });
