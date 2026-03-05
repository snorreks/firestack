# firestack<!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@snorreks/firestack)](https://www.npmjs.com/package/@snorreks/firestack)

Firestack is a CLI tool for building, testing, and deploying Firebase Cloud Functions with ease. Write your functions in TypeScript and deploy them seamlessly to Google Cloud Functions (v2), leveraging esbuild for optimal performance and a better developer experience.

## Features

- **TypeScript First**: Write functions in standard TypeScript with modern features.
- **Auto-Discovery**: Automatically finds and builds functions based on your file structure.
- **Optimized Builds**: Uses esbuild to bundle functions into small, efficient packages.
- **Multi-Environment (Flavors)**: Robust flavor support for development, staging, and production environments.
- **Emulator Support**: Run Firebase emulators with live reload and automated initialization scripts.
- **Rules & Indexes**: Manage and deploy Firestore and Storage rules alongside your functions.
- **Configurable Execution**: Support for `bun`, `node`, `tsx`, and more via a configurable engine.
- **Caching**: Flexible function deployment caching (supports remote caching for faster team deployments).

## Installation

```bash
npm install @snorreks/firestack
# or
bun add @snorreks/firestack
```

## Quick Start

### 1. Setup Configuration

Create a `firestack.json` in your project root:

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
  "initScript": "on_emulate.ts",
  "nodeVersion": "22",
  "engine": "bun"
}
```

### 2. Create a Function

Create a file in your functions directory (default: `src/controllers`):

```typescript
// src/controllers/api/hello.ts
import { onRequest } from "@snorreks/firestack";

export default onRequest(
  (req, res) => {
    res.send({ message: "Hello from Firestack!" });
  },
  {
    region: "us-central1",
    memory: "256MiB",
  },
);
```

### 3. Deploy

```bash
firestack deploy --flavor development
```

## Configuration (firestack.json)

| Option               | Type    | Default           | Description                                                                 |
| -------------------- | ------- | ----------------- | --------------------------------------------------------------------------- |
| `flavors`            | object  | `{}`              | Map of flavor names to Firebase project IDs.                                |
| `region`             | string  | `us-central1`     | Default region for all deployed functions.                                  |
| `functionsDirectory` | string  | `src/controllers` | Directory where your function controllers are located.                      |
| `rulesDirectory`     | string  | `src/rules`       | Directory containing Firestore/Storage rules and indexes.                   |
| `scriptsDirectory`   | string  | `scripts`         | Directory for custom maintenance/initialization scripts.                    |
| `initScript`         | string  | `on_emulate.ts`   | Script to run automatically when starting the emulator.                     |
| `nodeVersion`        | string  | `22`              | Node.js runtime version for Cloud Functions.                                |
| `engine`             | string  | `bun`             | The execution engine for running scripts (e.g., `bun`, `node`, `tsx`).      |
| `packageManager`     | string  | `npm`             | The package manager to use for `firebase` commands (`npm`, `yarn`, `pnpm`, `bun`, `global`). |
| `minify`             | boolean | `true`            | Whether to minify the bundled function code.                               |
| `external`           | string[]| `[]`              | List of dependencies to treat as external (not bundled) and install via npm.|

## Commands & Options

### `firestack deploy`
Builds and deploys functions to Firebase.

- `--flavor <flavor>`: The environment to deploy to (default: `development`).
- `--dry-run`: Show deployment commands without executing them.
- `--force`: Force deploy all functions, ignoring the deployment cache.
- `--only <names>`: Deploy specific functions (comma-separated).
- `--region <region>`: Override the default deployment region.
- `--concurrency <num>`: Number of functions to deploy in parallel (default: `5`).
- `--retryAmount <num>`: Number of times to retry failed deployments.
- `--no-minify`: Disable code minification.
- `--no-sourcemap`: Disable sourcemap generation.
- `--projectId <id>`: Manually specify the Firebase project ID.
- `--node-version <v>`: Override the Node.js version.
- `--external <deps>`: Comma-separated list of dependencies to exclude from bundling and install in the function environment.
- `--packageManager <pm>`: Specify package manager for firebase commands (default: `npm`).
- `--verbose`: Enable detailed logging.

### `firestack emulate`
Starts the Firebase emulator with live reload.

- `--flavor <flavor>`: The flavor to use for emulation.
- `--only <services>`: Services to emulate (default: `functions,firestore`).
- `--init / --no-init`: Run the `initScript` on startup (default: `true`).
- `--watch / --no-watch`: Enable/disable file watching (default: `true`).
- `--engine <engine>`: Use a specific engine to run the init script.
- `--packageManager <pm>`: Specify package manager for firebase commands.
- `--external <deps>`: Dependencies to exclude from bundling.
- `--firestoreRules <path>`: Path to Firestore rules (default: `firestore.rules`).
- `--storageRules <path>`: Path to Storage rules (default: `storage.rules`).

### `firestack scripts [scriptName]`
Runs a custom script from the `scriptsDirectory`. If no name is provided, an interactive selector appears.

- `--flavor <flavor>`: The flavor context for the script.
- `--engine <engine>`: The engine to run the script with (e.g., `bun`, `node`).
- `--verbose`: Enable verbose output.

### `firestack rules`
Deploys Firestore and Storage rules/indexes.

- `--only <components>`: Specific components to deploy (e.g., `firestore`, `storage`).

### `firestack delete`
Deploys unused functions from your Firebase project.

- `--all`: Delete ALL functions in the project.
- `--dry-run`: List functions that would be deleted.

### `firestack logs`
View Cloud Function logs.

- `-n, --lines <number>`: Number of log lines to fetch (default: `50`).
- `--since <duration>`: Show logs after this time (e.g., `1h`, `30m`).
- `--open`: Open the logs in your web browser.

## Advanced Usage

### Script Environment & Config
When running scripts via `firestack scripts` or during emulation, Firestack can load environment-specific configurations.

Create a `script-config.{flavor}.ts` file in your project root:

```typescript
// script-config.development.ts
export const config = {
  apiKey: "dev-key",
  serviceAccount: { ... }
};
```

This config is passed to your script via the `SCRIPT_CONFIG` environment variable (JSON stringified).

### Emulator Initialization (`on_emulate.ts`)
Automate your development setup by seeding the emulator with data:

```typescript
// scripts/on_emulate.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export async function run(context: { projectId: string }) {
  const db = getFirestore(initializeApp({ projectId: context.projectId }));
  await db.collection('users').doc('dev-user').set({ name: 'Dev User' });
  console.log('✅ Emulator seeded!');
}

export default run;
```

### Remote Functions Cache
Speed up deployments in CI/CD or across teams by using a remote cache. Create a `functions-cache.ts` in your root:

```typescript
import type { FunctionsCacheGet, FunctionsCacheUpdate } from '@snorreks/firestack';

export const get: FunctionsCacheGet = async ({ flavor }) => {
  // Fetch your cache from an API, Database, or S3
  const response = await fetch(`https://api.myapp.com/cache/${flavor}`);
  return await response.json();
};

export const update: FunctionsCacheUpdate = async ({ flavor, newFunctionsCache }) => {
  // Save the updated cache back to your remote storage
  await fetch(`https://api.myapp.com/cache/${flavor}`, {
    method: 'PUT',
    body: JSON.stringify(newFunctionsCache)
  });
};
```

### Rules Management
Organize your rules in the `rulesDirectory`:

- `firestore.rules`: Firestore security rules.
- `firestore.indexes.json`: Firestore index definitions.
- `storage.rules`: Cloud Storage security rules.

Deploy them using `firestack rules --flavor production`.

## License

MIT
