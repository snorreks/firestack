# firestack<!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@snorreks/firestack)](https://www.npmjs.com/package/@snorreks/firestack)

Firestack is a CLI tool for building, testing, and deploying Firebase Cloud Functions. Write your functions in standard TypeScript and deploy them to Google Cloud Functions (v2), leveraging esbuild for fast builds and a smooth developer experience.

## Features

- **TypeScript First**: Write functions in standard TypeScript with modern features.
- **Auto-Discovery**: Automatically finds and builds functions based on your file structure.
- **Parallel Execution**: Uses a worker-pool pattern for concurrent deployments.
- **Multi-Environment (Flavors)**: Support for development, staging, and production environments.
- **Emulator Support**: Run Firebase emulators with live reload, auto-open UI, and initialization scripts.
- **Intelligent Caching**: Differential deployments with local and remote cache support.
- **Rules & Indexes**: Manage and deploy Firestore and Storage rules alongside your functions.

## Installation

```bash
npm install @snorreks/firestack
# or
bun add @snorreks/firestack
```

## Quick Start

### 1. Setup Configuration

Create a `firestack.json` in your project root. You can add the `$schema` property to get autocompletion and validation in your editor. We recommend pointing to the schema in your `node_modules` for the best performance:

```json
{
  "$schema": "./node_modules/@snorreks/firestack/firestack.schema.json",
  "flavors": {
    "development": "my-project-dev",
    "production": "my-project-prod"
  },
  "region": "us-central1",
  "functionsDirectory": "src/controllers",
  "rulesDirectory": "src/rules",
  "scriptsDirectory": "scripts",
  "initScript": "on_emulate.ts",
  "nodeVersion": "24",
  "engine": "bun",
  "packageManager": "global"
}
```

Alternatively, you can use the remote schema if you are not using a local installation:
`https://raw.githubusercontent.com/snorreks/firestack/master/firestack.schema.json`

## Gemini CLI Integration (Skill)

If you use [Gemini CLI](https://github.com/google/gemini-cli) (or other AI-powered agents), you can install the **Firestack Skill** to give your agent native knowledge of your project's deployment workflows, triggers, and configuration.

### Install the Skill

Download the `firestack.skill` file and run:

```bash
# Install to your current project workspace
gemini skills install firestack.skill --scope workspace

# OR Install for all your projects (user scope)
gemini skills install firestack.skill --scope user
```

### Activate

After installation, run `/skills reload` in your interactive Gemini session. Your agent will now understand how to deploy functions, manage emulators, and write v2 triggers according to Firestack standards.

### 2. Create a Function

Create a file in your functions directory (e.g., `src/controllers/api/hello.ts`):

```typescript
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

**Important: One Function Per File**

Firestack auto-discovers functions based on your file structure. Each file must contain **exactly ONE function** exported as default:

```
src/controllers/
  api/
    hello.ts       <- one function (export default)
    goodbye.ts     <- another function
  firestore/
    users/
      [uid]/
        created.ts <- Firestore onCreate trigger
        deleted.ts <- Firestore onDelete trigger
  scheduler/
    daily.ts       <- Scheduled function
```

The file name and path determine the function name and trigger type:
- `api/hello.ts` → HTTP function named `hello`
- `firestore/users/[uid]/created.ts` → Firestore trigger on `users/{uid}` collection
- `scheduler/daily.ts` → Scheduled function

### 3. Deploy

```bash
firestack deploy --flavor development
```

## Configuration (firestack.json)

| Option               | Type     | Default           | Description                                                                           |
| -------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------- |
| `flavors`            | object   | `{}`              | Map of flavor names to Firebase project IDs.                                          |
| `region`             | string   | `us-central1`     | Default region for all deployed functions.                                            |
| `functionsDirectory` | string   | `src/controllers` | Directory where your function controllers are located.                                |
| `rulesDirectory`     | string   | `src/rules`       | Directory containing Firestore/Storage rules and indexes.                             |
| `scriptsDirectory`   | string   | `scripts`         | Directory for custom maintenance/initialization scripts.                              |
| `initScript`         | string   | `on_emulate.ts`   | Script to run automatically when starting the emulator.                               |
| `nodeVersion`        | string   | `22`              | Node.js runtime version for Cloud Functions (e.g., `20`, `22`, `24`).                 |
| `engine`             | string   | `bun`             | The execution engine for running scripts (e.g., `bun`, `node`).                       |
| `packageManager`     | string   | `global`          | The package manager for `firebase` commands (`npm`, `yarn`, `pnpm`, `bun`, `global`). |
| `minify`             | boolean  | `true`            | Whether to minify the bundled function code.                                          |
| `sourcemap`          | boolean  | `true`            | Whether to generate sourcemaps.                                                       |
| `external`           | string[] | `[]`              | Dependencies to treat as external (installed in the function env).                    |

## Commands & Options

### `firestack deploy`

Builds and deploys functions to Firebase.

- `--flavor <flavor>`: The environment to deploy to.
- `--dry-run`: Show the deployment plan without executing it.
- `--force`: Force deploy all functions, ignoring the cache.
- `--only <names>`: Deploy specific functions (comma-separated).
- `--all`: Deploy both functions AND rules in one command.
- `--concurrency <num>`: Parallel deployments (default: `5`).
- `--retryAmount <num>`: Auto-retry failed deployments.
- `--verbose`: Show detailed Firebase output.

### `firestack emulate`

Starts the Firebase emulator with live reload and real-time UI detection.

- `--open`: Automatically opens the Emulator UI in your browser once it's ready.
- `--watch` / `--no-watch`: Enable/disable file watching for live reload (default: `true`).
- `--init` / `--no-init`: Run/skip the initialization script (default: `true`).
- `--projectId <id>`: Override the Firebase project ID for emulation.
- `--only <services>`: Only start specified services (e.g., `functions,firestore`).
- `--flavor <flavor>`: The flavor context for emulation.
- `--verbose`: Stream full emulator logs to the console.

### `firestack rules`

Deploys security rules and indexes with differential checking.

- `--only <targets>`: Specific components (e.g., `firestore`, `storage`).
- `--force`: Force deploy even if no changes are detected.

### `firestack delete`

Removes unused functions from your Firebase project.

- `--all`: Delete all functions in the project.
- `--dry-run`: List functions that would be removed without deleting them.

### `firestack scripts [scriptName]`

Runs a custom script from the `scriptsDirectory`. If no name is provided, an interactive selector appears.

- `--flavor <flavor>`: The flavor context for the script.
- `--engine <engine>`: Override the default execution engine.

### `firestack logs`

View Cloud Function logs from the production environment.

- `-n, --lines <num>`: Number of lines to fetch (default: `50`).
- `--since <time>`: Show logs after a specific time (e.g., `1h`, `30m`).
- `--open`: Open the logs in the web browser.

## Advanced Usage

### Script Environment & Config

When running scripts via `firestack scripts` or during emulation, Firestack can load flavor-specific configurations. Create a `script-config.{flavor}.ts` file in your project root:

```typescript
// script-config.development.ts
export const config = {
  apiKey: "dev-key",
  baseUrl: "http://localhost:3000",
};
```

This config is passed to your script via the `SCRIPT_CONFIG` environment variable (JSON stringified).

### Emulator Initialization (`on_emulate.ts`)

Automate your setup by seeding the emulator with data. Create a script in your `scriptsDirectory`:

```typescript
// scripts/on_emulate.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firestack runs this script automatically when the emulator starts
const db = getFirestore(initializeApp({ projectId: "demo-project" }));
await db.collection("users").doc("dev-user").set({ name: "Dev User" });
console.log("✅ Emulator seeded!");
```

### Remote Functions Cache

Share deployment states across your team by creating a `functions-cache.ts` in your project root:

```typescript
import type {
  FunctionsCacheGet,
  FunctionsCacheUpdate,
} from "@snorreks/firestack";

export const get: FunctionsCacheGet = async ({ flavor }) => {
  // Fetch cached checksums from your remote storage
};

export const update: FunctionsCacheUpdate = async ({
  flavor,
  newFunctionsCache,
}) => {
  // Save updated checksums to your remote storage
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
