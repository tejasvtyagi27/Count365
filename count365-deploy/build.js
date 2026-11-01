/* ============================================================
   COUNT365 build script
   Reads SUPABASE_URL and SUPABASE_ANON_KEY from environment variables
   (or a local .env file), then writes the site into dist/ together with
   a generated config.js. No dependencies needed.
   ============================================================ */
const fs = require('fs');
const path = require('path');

// Minimal .env loader. Real environment variables (e.g. on Vercel) win.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  console.error('Locally: copy .env.example to .env and fill it in.');
  console.error('On Vercel: add both under Project Settings -> Environment Variables.');
  process.exit(1);
}

// Safety check: refuse secret keys, which must never reach the browser.
function isSecretKey(k) {
  if (k.startsWith('sb_secret_')) return true;
  try {
    const payload = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8'));
    return payload.role === 'service_role';
  } catch (e) {
    return false;
  }
}
if (isSecretKey(key)) {
  console.error('This looks like a secret (service_role) key. Use the anon / publishable key instead.');
  process.exit(1);
}

const out = path.join(__dirname, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

['index.html', 'style.css', 'script.js', 'db.js', 'routines.js', 'auth.js'].forEach(f => {
  fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
});

fs.writeFileSync(
  path.join(out, 'config.js'),
  'window.COUNT365_CONFIG = ' +
    JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2) + ';\n'
);

console.log('Built dist/');