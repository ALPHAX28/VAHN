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
let pythonBin = venvPython;

if (fs.existsSync(venvPython)) {
  console.log(`\x1b[32m✔ Using virtual environment: backend/.venv\x1b[0m`);
} else {
  console.error('\x1b[31m✘ ERROR: No virtual environment found at backend/.venv.\x1b[0m');
  console.error('\x1b[33m  Please run "npm run setup:docker" first to initialize the environment and install dependencies.\x1b[0m');
  process.exit(1);
}

// Helper to parse database host from env
let isLocalDb = true;
const backendEnvPath = path.join(backendDir, '.env');
if (fs.existsSync(backendEnvPath)) {
  const envContent = fs.readFileSync(backendEnvPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      const key = match[1];
      const value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
      if (key === 'DB_HOST') {
        isLocalDb = (value === 'localhost' || value === '127.0.0.1' || value === 'db' || value === 'vahn-postgres-db');
      } else if (key === 'DATABASE_URL' && !envContent.includes('DB_HOST=')) {
        const hostMatch = value.match(/@([^:/]+)/);
        if (hostMatch) {
          const dbHost = hostMatch[1];
          isLocalDb = (dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === 'db' || dbHost === 'vahn-postgres-db');
        }
      }
    }
  });
}

// ─── DB connectivity check ────────────────────────────────────────────────────
console.log('\nRunning database connectivity check...');

if (isLocalDb) {
  let dockerRunning = true;
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch (err) {
    dockerRunning = false;
  }

  if (!dockerRunning) {
    console.error('\n\x1b[31m✘ ERROR: Docker is not running.\x1b[0m');
    console.error('\x1b[33m  Please ensure Docker Desktop is open and running.\x1b[0m\n');
    process.exit(1);
  }

  let containerExists = false;
  let containerRunning = false;

  try {
    const result = execSync('docker inspect -f "{{.State.Running}}" vahn-postgres-db', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    containerExists = true;
    containerRunning = (result === 'true');
  } catch (err) {
    containerExists = false;
  }

  if (!containerExists) {
    console.error('\n\x1b[31m✘ ERROR: PostgreSQL container "vahn-postgres-db" does not exist.\x1b[0m');
    console.error('\x1b[33m  Please run "npm run setup:docker" first to initialize the database and seed metadata.\x1b[0m\n');
    process.exit(1);
  }

  if (!containerRunning) {
    console.log('\n\x1b[33m⚠ PostgreSQL container is stopped. Starting it now...\x1b[0m');
    try {
      execSync('docker-compose up -d db', { stdio: 'inherit', cwd: ROOT, shell: true });
      console.log('Waiting 5 seconds for PostgreSQL to warm up...');
      execSync('python -c "import time; time.sleep(5)"', { shell: true });
    } catch (err) {
      console.error('\nERROR: Failed to start the database container. Please ensure Docker is running.');
      process.exit(1);
    }
  }
} else {
  console.log('\x1b[32m✔ Remote PostgreSQL database detected. Skipping local container status checks.\x1b[0m');
}

// Run the connectivity check
try {
  execSync(`"${pythonBin}" check_db.py`, { stdio: 'inherit', cwd: ROOT, shell: true });
} catch {
  console.error('\nERROR: Database check failed. Please ensure Docker is running and healthy.');
  process.exit(1);
}

// Verify Alembic migrations are up to date
console.log('Checking database migrations status...');
try {
  execSync(`"${pythonBin}" -m alembic check`, { cwd: backendDir, stdio: 'ignore' });
  console.log('\x1b[32m✔ Database migrations are up-to-date\x1b[0m');
} catch (err) {
  console.error('\n\x1b[31m✘ ERROR: Database migrations are not up-to-date with the latest schema.\x1b[0m');
  console.error('\x1b[33m  Please run "npm run setup:docker" first to apply migrations and seed metadata.\x1b[0m\n');
  process.exit(1);
}

console.log('\nDatabase is ready! Starting dev servers...');

// ─── Read backend/.env for host/port ─────────────────────────────────────────
let host = '0.0.0.0';
let port = '8000';

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
  if (isLocalDb) {
    try {
      execSync('docker-compose stop db', { stdio: 'ignore', cwd: ROOT });
    } catch (e) {}
  }
  backendProcess.kill('SIGINT');
  frontendProcess.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  if (isLocalDb) {
    try {
      execSync('docker-compose stop db', { stdio: 'ignore', cwd: ROOT });
    } catch (e) {}
  }
  backendProcess.kill();
  frontendProcess.kill();
});
