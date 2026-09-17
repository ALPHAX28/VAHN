---
name: frontend-quality-gate
description: >-
  Execute the mandatory Frontend Quality Gate: run the TypeScript compiler (tsc --noEmit),
  Biome linter & formatter (biome check / biome lint), and Next.js standalone build verification.
  Use whenever frontend components, pages, hooks, layouts, or configs are modified.
---

# Frontend Quality Gate Skill

This skill defines the mandatory workflow for validating all Next.js frontend code before committing or pushing changes to the `dev` branch.

## Prerequisites

All commands must be executed within the `frontend/` directory (`c:\Users\arnab\shopify-migration\nextjs-vahn\frontend`):
```powershell
cd c:\Users\arnab\shopify-migration\nextjs-vahn\frontend
```

---

## The 3-Step Quality Gate Workflow

### Step 1: TypeScript Compiler Check (Strict Type Safety)

Run `tsc` without emitting code to catch all typing errors, missing imports, bad props, and syntax mistakes:
```powershell
npx tsc --noEmit
```
- **Exit Code**: Must be `0`.
- **Zero Errors Allowed**: Fix all reported type mismatches or missing property errors before proceeding.

---

### Step 2: Biome Linter & Formatter Validation

Biome provides sub-50ms linting and formatting:
```powershell
# 1. Check linting and formatting issues:
npm run check:biome

# 2. Or check linter rules only:
npm run lint:biome

# 3. Apply safe formatting and import sorting fixes automatically:
npm run format:biome
```
- Ensure zero error diagnostics remain before proceeding.

---

### Step 3: Next.js Production Build Validation

When modifying:
- Root layouts (`frontend/app/layout.tsx`)
- Core styling or theme configs (`frontend/app/globals.css`)
- Route hierarchies or dynamic route segments (`[handle]`, `[id]`)
- Next.js config (`frontend/next.config.js`)
- Critical shared state (`CartContext`, `AuthContext`, `swr.ts`)

Run the Next.js standalone build:
```powershell
npm run build
```
- **Verification**:
  - Build completes with `✓ Compiled successfully`.
  - All static and dynamic routes generate without SSR hydration mismatches or unhandled server-side exceptions.
  - Standalone output is generated cleanly into `.next/standalone`.

---

## Architectural Conventions Checklist

Before passing the quality gate, ensure:
1. **Toast Notifications**: Used `import { toast } from 'sonner'` (`toast.success()`, `toast.error()`). No one-off `useState("")` alert blocks.
2. **Client Fetching & Polling**: Used `useApi` from `@/lib/swr` for cached client queries.
3. **Image Optimization**: Used Next.js `<Image />` with AVIF/WebP formats.
4. **Git Branch**: All work is committed to `dev`. Never push to `main` without explicit verbatim authorization.
