# firestack<!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@snorreks/firestack)](https://www.npmjs.com/package/@snorreks/firestack)

Firestack is a CLI tool for deploying Firebase Cloud Functions with ease. Write your functions in TypeScript and deploy them seamlessly to Google Cloud Functions (v2), leveraging esbuild for optimal performance.

## Features

- **TypeScript First**: Write functions in standard TypeScript.
- **Auto-Discovery**: Automatically finds and deploys functions based on your file structure.
- **Optimized Builds**: Uses esbuild to bundle functions into small, efficient packages.
- **Multi-Environment**: Robust flavor support (development/production).
- **Rules & Indexes**: Deploy Firestore and Storage rules automatically.
- **Emulator Support**: Run Firebase emulators with live reload.
- **Init Scripts**: Populate Firestore with seed data during emulation.
- **Moon Support**: Works great with moonrepo monorepos.

## Installation

```bash
npm install @snorreks/firestack
# or
bun add @snorreks/firestack
```

## Quick Start

### 1. Setup Configuration

Create a `firestack.json` in your functions directory:

```json
{
  "flavors": {
    "development": "my-project-dev",
    "production": "my-project-prod"
  },
  "region": "us-central1",
  "functionsDirectory": "src/controllers",
  "rulesDirectory": "src/rules",
  "scriptsDirectory": "scripts",
  "nodeVersion": "20"
}
```

### 2. Create a Function

Create a file in your functions directory (default: `src/controllers`):

```typescript
// src/controllers/api/hello.ts
import { onRequest } from '@snorreks/firestack';

export default onRequest((req, res) => {
  res.send({ message: "Hello from Firestack!" });
}, {
  region: 'europe-west1'
});
```

### 3. Deploy

```bash
firestack deploy --flavor development
```

## Commands

| Command | Description |
|---------|-------------|
| `firestack build` | Build functions for local development |
| `firestack deploy` | Build and deploy functions to Firebase |
| `firestack delete` | Delete unused functions |
| `firestack emulate` | Run Firebase emulators with live reload |
| `firestack rules` | Deploy Firestore and Storage rules |
| `firestack scripts` | Run scripts from the scripts directory |
| `firestack logs` | View function logs |

## Folder Structure

```
src/
├── controllers/       # Cloud Functions
│   ├── api/         # HTTP functions
│   ├── firestore/   # Firestore triggers
│   ├── scheduler/   # Scheduled tasks
│   └── auth/        # Auth triggers
├── rules/           # Firestore & Storage rules
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
└── scripts/         # Deployment scripts
    └── init.ts      # Emulator init script
```

## Configuration

### firestack.json Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flavors` | object | `{}` | Map of flavor names to project IDs |
| `region` | string | `us-central1` | Default region for functions |
| `functionsDirectory` | string | `src/controllers` | Where functions are located |
| `rulesDirectory` | string | `src/rules` | Where rules files are located |
| `scriptsDirectory` | string | `scripts` | Where scripts are located |
| `initScript` | string | `init.ts` | Script to run before emulator |
| `nodeVersion` | string | `20` | Node.js runtime version |
| `minify` | boolean | `true` | Minify bundled functions |

### Common CLI Options

- `--flavor`: Target environment (e.g., `production`, `development`)
- `--only`: Deploy specific functions (comma-separated)
- `--force`: Force deploy all functions, ignoring cache
- `--dry-run`: Build without deploying

## Emulator

Run emulators with:
```bash
firestack emulate
```

The emulator will:
1. Run your init script (if exists) to populate Firestore
2. Build all functions
3. Start Firebase emulators with live reload

Use `--no-init` to skip the init script, or `--no-watch` to disable file watching.

## License

MIT
