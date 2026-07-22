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
let pythonBin = venvPython;

if (!fs.existsSync(venvPython)) {
  console.log('\x1b[33m⚠ No virtual environment found at backend/.venv. Initializing it now...\x1b[0m');
  try {
    // 1. Create venv
    execSync('python -m venv .venv', { cwd: backendDir, stdio: 'inherit', shell: true });
    
    // 2. Install requirements
    const venvPip = isWin
      ? path.join(venvDir, 'Scripts', 'pip.exe')
      : path.join(venvDir, 'bin', 'pip');
    execSync(`"${venvPip}" install --upgrade pip`, { cwd: backendDir, stdio: 'inherit', shell: true });
    execSync(`"${venvPip}" install -r requirements.txt`, { cwd: backendDir, stdio: 'inherit', shell: true });
    
    // 3. Create lock
    execSync(`"${venvPython}" "${path.join(ROOT, 'create_pylock.py')}"`, { cwd: ROOT, stdio: 'inherit', shell: true });
    
    console.log('\x1b[32m✔ Virtual environment successfully initialized and locked!\x1b[0m');
  } catch (err) {
    console.error('\x1b[31m✘ Failed to initialize virtual environment. Aborting production startup.\x1b[0m');
    process.exit(1);
  }
} else {
  console.log('\x1b[32m✔ Using existing virtual environment: backend/.venv\x1b[0m');
}

// Helper to parse database host from env
let isLocalDb = true;
const backendEnvPath = path.join(backendDir, '.env');
if (fs.existsSync(backendEnvPath)) {
  const envContent = fs.readFileSync(backendEnvPath, 'utf8');
  let dbUrl = '';
  let dbHostEnv = '';
  
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      const key = match[1];
      const value = (match[2] || '').trim().replace(/^["']|["']$/g, '');
      if (key === 'DATABASE_URL') {
        dbUrl = value;
      } else if (key === 'DB_HOST') {
        dbHostEnv = value;
      }
    }
  });

  if (dbUrl) {
    const hostMatch = dbUrl.match(/@([^:/]+)/);
    if (hostMatch) {
      const dbHost = hostMatch[1];
      isLocalDb = (dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === 'db' || dbHost === 'vahn-postgres-db');
    }
  } else if (dbHostEnv) {
    isLocalDb = (dbHostEnv === 'localhost' || dbHostEnv === '127.0.0.1' || dbHostEnv === 'db' || dbHostEnv === 'vahn-postgres-db');
  }
}

// ─── DB container pre-check ──────────────────────────────────────────────────
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

prefixOutput('backend', backendProcess.stdout, '32');
prefixOutput('backend', backendProcess.stderr, '33');
prefixOutput('frontend', frontendProcess.stdout, '36');
prefixOutput('frontend', frontendProcess.stderr, '35');

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function cleanup() {
  console.log('\n\x1b[33mStopping production servers...\x1b[0m');
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
