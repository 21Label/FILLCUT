import { writeFile } from 'node:fs/promises';

const fields = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  appId: 'FIREBASE_APP_ID',
};
const firebaseConfig = Object.fromEntries(Object.entries(fields).map(
  ([key, variable]) => [key, process.env[variable]?.trim()],
));
const missing = Object.keys(fields).filter(key => !firebaseConfig[key]);
if (missing.length) {
  throw new Error('Faltan variables: ' + missing.map(key => fields[key]).join(', '));
}
const config = JSON.stringify({
  firebaseConfig,
  appleEnabled: process.env.FIREBASE_APPLE_ENABLED === 'true',
}, null, 2) + '\n';
await Promise.all(['../auth-config.json', '../dist/auth-config.json'].map(
  path => writeFile(new URL(path, import.meta.url), config),
));
