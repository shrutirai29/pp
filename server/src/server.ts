import dotenv from 'dotenv';
import { loadConfig } from './config/env.js';
import { initDatabase } from './db/database.js';
import { createApp } from './app.js';

// Load environment variables from process.cwd() or fallback paths
dotenv.config();
dotenv.config({ path: 'server/.env' });
dotenv.config({ path: '../.env' });

const config = loadConfig();
const db = initDatabase(config.DATABASE_PATH);
const app = createApp(db, config);

app.listen(config.PORT, () => {
  console.log(`[DealMind IntentLock Server] running on http://localhost:${config.PORT} (mode: ${config.NODE_ENV})`);
  console.log(`[Database] initialized at ${config.DATABASE_PATH}`);
});
