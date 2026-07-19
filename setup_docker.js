/**
 * setup_docker.js — VAHN Full Environment Setup
 *
 * Steps:
 *  1. Start PostgreSQL in Docker
 *  2. Create Python virtual environment (.venv) in backend/
 *  3. Install Python dependencies into venv
 *  4. Generate pylock.toml (locked deps)
 *  5. Run Alembic migrations
 *  6. Seed the database
 *  7. Install Next.js frontend dependencies
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const backendDir = path.join(ROOT, 'backend');
const venvDir = path.join(backendDir, '.venv');

// ─── Detect venv python/pip paths ────────────────────────────────────────────
const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');
const venvPip = isWin
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

// ─── Helper ──────────────────────────────────────────────────────────────────
function runCommand(cmd, options = {}) {
  console.log(`\n> Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, ...options });
    return true;
  } catch (err) {
    console.error(`Error executing: ${cmd}`);
    return false;
  }
}

function step(n, total, msg) {
  console.log(`\n\x1b[1;34m--- Step ${n}/${total}: ${msg} ---\x1b[0m`);
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

console.log('\n\x1b[1m=== VAHN Standalone Decoupled Storefront Setup ===\x1b[0m');

// ─── Step 1: Docker ──────────────────────────────────────────────────────────
step(1, 7, 'Starting PostgreSQL Database in Docker');
if (isLocalDb) {
  if (!runCommand('docker-compose up -d')) {
    console.error('\nERROR: Failed to start docker-compose. Make sure Docker Desktop is running.');
    process.exit(1);
  }
  console.log('Waiting 5 seconds for PostgreSQL to warm up...');
  execSync('python -c "import time; time.sleep(5)"', { shell: true });
} else {
  console.log('\x1b[32m✔ Remote PostgreSQL database detected. Skipping local container startup.\x1b[0m');
}

// ─── Step 2: Create virtual environment ──────────────────────────────────────
step(2, 7, 'Creating Python virtual environment (backend/.venv)');
if (fs.existsSync(venvDir)) {
  console.log('  .venv already exists — skipping creation.');
} else {
  if (!runCommand('python -m venv .venv', { cwd: backendDir })) {
    console.error('\nERROR: Failed to create virtual environment. Make sure Python 3.9+ is installed.');
    process.exit(1);
  }
  console.log('\x1b[32m✔ Virtual environment created at backend/.venv\x1b[0m');
}

// ─── Step 3: Install Python dependencies into venv ───────────────────────────
step(3, 7, 'Installing Python dependencies into virtual environment');
if (!runCommand(`"${venvPip}" install --upgrade pip`, { cwd: backendDir })) {
  console.warn('WARNING: pip upgrade failed — continuing with existing pip version.');
}
if (!runCommand(`"${venvPip}" install -r requirements.txt`, { cwd: backendDir })) {
  console.error('\nERROR: Failed to install Python dependencies.');
  process.exit(1);
}
console.log('\x1b[32m✔ Backend dependencies installed\x1b[0m');

// ─── Step 4: Generate pylock.toml ────────────────────────────────────────────
step(4, 7, 'Generating pylock.toml (locked dependency snapshot)');
if (!runCommand(`"${venvPython}" "${path.join(ROOT, 'create_pylock.py')}"`, { cwd: ROOT })) {
  console.warn('WARNING: pylock.toml generation failed — non-critical, continuing.');
} else {
  console.log('\x1b[32m✔ pylock.toml generated\x1b[0m');
}

// ─── Step 5: Run Alembic migrations ──────────────────────────────────────────
step(5, 7, 'Running Alembic Migrations');
if (!runCommand(`"${venvPython}" -m alembic upgrade head`, { cwd: backendDir })) {
  console.error('\nERROR: Alembic migrations failed.');
  process.exit(1);
}
console.log('\x1b[32m✔ Migrations applied\x1b[0m');

// ─── Step 6: Seed database ───────────────────────────────────────────────────
step(6, 7, 'Seeding mock VAHN product data');
if (!runCommand(`"${venvPython}" seed.py`, { cwd: backendDir })) {
  console.error('\nERROR: Database seeding failed.');
  process.exit(1);
}
console.log('\x1b[32m✔ Database seeded\x1b[0m');

// ─── Step 7: Frontend deps ───────────────────────────────────────────────────
step(7, 7, 'Installing Frontend dependencies (npm install)');
if (!runCommand('npm install', { cwd: path.join(ROOT, 'frontend') })) {
  console.error('\nERROR: Next.js npm install failed.');
  process.exit(1);
}
console.log('\x1b[32m✔ Frontend dependencies installed\x1b[0m');

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1;32m==================================================');
console.log('Setup completed successfully! ✅');
console.log('Virtual env: backend/.venv');
console.log('Lock file:   backend/pylock.toml');
console.log('\nRun development:  npm run dev:docker');
console.log('Run production:   npm run prod:start');
console.log('==================================================\x1b[0m\n');
process.exit(0);
