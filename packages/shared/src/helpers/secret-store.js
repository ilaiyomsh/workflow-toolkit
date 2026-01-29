import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the project root directory (3 levels up from this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../../../');

// Load .env from project root
dotenv.config({ path: resolve(projectRoot, '.env') });

export const getSecret = (key) => {
  return process.env[key];
};
