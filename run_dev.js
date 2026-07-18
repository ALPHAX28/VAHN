/**
 * run_dev.js — VAHN Development Server
 *
 * Loads the backend virtual environment (.venv) then starts:
 *  - FastAPI (uvicorn --reload) with hot-reload
 *  - Next.js dev server
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const backendDir = path.join(ROOT, 'backend');
const venvDir = path.join(backendDir, '.venv');

const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

// ─── Resolve python binary ───────────────────────────────────────────────────
let pythonBin = 'python'; // fallback to system python

if (fs.existsSync(venvPython)) {
  pythonBin = venvPython;
  console.log(`\x1b[32m✔ Using virtual environment: backend/.venv\x1b[0m`);
} else {
  console.warn('\x1b[33m⚠ No virtual environment found at backend/.venv');
  console.warn('  Run "npm run setup:docker" first to create the venv.');
  console.warn('  Falling back to system Python...\x1b[0m');
}

// ─── DB connectivity check ────────────────────────────────────────────────────
console.log('\nRunning database connectivity check...');
try {
  execSync(`"${pythonBin}" check_db.py`, { stdio: 'inherit', cwd: ROOT, shell: true });
} catch {
  console.error('\nERROR: Database check failed. Exiting.');
  process.exit(1);
}
console.log('\nDatabase is ready! Starting dev servers...');

// ─── Read backend/.env for host/port ─────────────────────────────────────────
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

// ─── Start Backend (FastAPI with hot reload) ──────────────────────────────────
const backendProcess = spawn(
  `"${pythonBin}"`,
  ['-m', 'uvicorn', 'main:app', '--reload', '--host', host, '--port', port],
  { cwd: backendDir, shell: true }
);

// ─── Start Frontend (Next.js dev) ─────────────────────────────────────────────
const frontendProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(ROOT, 'frontend'),
  shell: true,
});

// ─── Prefixed output ──────────────────────────────────────────────────────────
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

prefixOutput('backend ', backendProcess.stdout, '32');
prefixOutput('backend ', backendProcess.stderr, '32');
prefixOutput('frontend', frontendProcess.stdout, '36');
prefixOutput('frontend', frontendProcess.stderr, '36');

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function cleanup() {
  console.log('\nStopping dev servers...');
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
