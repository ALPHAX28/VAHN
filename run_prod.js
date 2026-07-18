/**
 * run_prod.js — VAHN Production Startup
 *
 * Steps:
 *  1. TypeScript check (frontend)
 *  2. Next.js production build (frontend)
 *  3. Alembic migrations (backend)
 *  4. Start FastAPI in production mode (no --reload)
 *  5. Start Next.js production server
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const backendDir = path.join(ROOT, 'backend');
const frontendDir = path.join(ROOT, 'frontend');
const venvDir = path.join(backendDir, '.venv');

const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

// Resolve python binary
let pythonBin = 'python';
if (fs.existsSync(venvPython)) {
  pythonBin = venvPython;
  console.log(`\x1b[32m✔ Using virtual environment: backend/.venv\x1b[0m`);
} else {
  console.warn('\x1b[33m⚠ No virtual environment found at backend/.venv');
  console.warn('  Run "npm run setup:docker" first.');
  console.warn('  Falling back to system Python...\x1b[0m');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function step(msg) {
  console.log(`\n\x1b[1;34m▶ ${msg}\x1b[0m`);
}

function ok(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function fail(msg) {
  console.error(`\x1b[31m✘ ${msg}\x1b[0m`);
  process.exit(1);
}

function run(cmd, cwd, label) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit', shell: true });
    ok(label);
  } catch {
    fail(`${label} — FAILED. Aborting.`);
  }
}

function prefixOutput(processName, stream, colorCode) {
  let buffer = '';
  stream.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    lines.forEach((line) => {
      console.log(`\x1b[${colorCode}m[${processName}]\x1b[0m ${line}`);
    });
  });
  stream.on('end', () => {
    if (buffer) console.log(`\x1b[${colorCode}m[${processName}]\x1b[0m ${buffer}`);
  });
}

// ─── Read backend .env for host/port ────────────────────────────────────────

let host = '0.0.0.0';
let port = '8000';

const backendEnvPath = path.join(backendDir, '.env');
if (fs.existsSync(backendEnvPath)) {
  fs.readFileSync(backendEnvPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
      if (match) {
        let key = match[1];
        let value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
        if (key === 'HOST') host = value;
        if (key === 'PORT') port = value;
      }
    });
}

// ─── 1. TypeScript check ─────────────────────────────────────────────────────

step('Step 1/4 — TypeScript type-check (frontend)');
run('npx tsc --noEmit', frontendDir, 'TypeScript check passed');

// ─── 2. Next.js production build ─────────────────────────────────────────────

step('Step 2/4 — Building Next.js production bundle (frontend)');
run('npm run build', frontendDir, 'Next.js build succeeded');

// ─── 3. Alembic migrations ────────────────────────────────────────────────────

step('Step 3/4 — Running Alembic migrations (backend)');
run(`"${pythonBin}" -m alembic upgrade head`, backendDir, 'Alembic migrations applied');

// ─── 4 & 5. Start servers ─────────────────────────────────────────────────────

step('Step 4/4 — Starting production servers');
console.log(`  Backend  → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
console.log(`  Frontend → http://localhost:3000\n`);

// FastAPI — no --reload in production
const backendProcess = spawn(
  `"${pythonBin}"`,
  ['-m', 'uvicorn', 'main:app', '--host', host, '--port', port, '--workers', '2'],
  { cwd: backendDir, shell: true }
);

// Next.js production server
const frontendProcess = spawn('npm', ['run', 'start'], {
  cwd: frontendDir,
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' },
});

prefixOutput('backend ', backendProcess.stdout, '32');
prefixOutput('backend ', backendProcess.stderr, '33');
prefixOutput('frontend', frontendProcess.stdout, '36');
prefixOutput('frontend', frontendProcess.stderr, '35');

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function cleanup() {
  console.log('\n\x1b[33mStopping production servers...\x1b[0m');
  backendProcess.kill('SIGINT');
  frontendProcess.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  backendProcess.kill();
  frontendProcess.kill();
});
