/* global process */
const mode = process.env.FAKE_APP_SERVER_MODE ?? 'success';
const fixtures = {
  success: { version: '0.121.0', authenticated: true, capabilities: ['develop'] },
  auth_required: { version: '0.121.0', authenticated: false, capabilities: [] },
  incompatible: { version: '0.120.0', authenticated: true, capabilities: ['develop'] },
  malformed: '{not-json}'
};
process.stdout.write(`${typeof fixtures[mode] === 'string' ? fixtures[mode] : JSON.stringify(fixtures[mode])}\n`);
