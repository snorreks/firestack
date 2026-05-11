# firestack<!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@snorreks/firestack)](https://www.npmjs.com/package/@snorreks/firestack)

Firestack is a CLI tool for building, testing, and deploying Firebase Cloud Functions. Write your functions in standard TypeScript and deploy them to Google Cloud Functions (v2), leveraging esbuild for fast builds and a smooth developer experience.

## Features

- **TypeScript First**: Write functions in standard TypeScript with modern features.
- **Auto-Discovery**: Automatically finds and builds functions based on your file structure.
- **Parallel Execution**: Uses a worker-pool pattern for concurrent deployments.
- **Multi-Environment (Modes)**: Support for development, staging, and production environments.
- **Emulator Support**: Run Firebase emulators with live reload, auto-open UI, and initialization scripts.
- **Native Rules Testing**: Test Firestore and Storage security rules against ephemeral emulators with zero config.
- **Intelligent Caching**: Differential deployments with local and remote cache support.
- **Rules & Indexes**: Manage and deploy Firestore and Storage rules alongside your functions.
- **Zero-Boilerplate Logging**: Auto-import your logger init file into every function; request-scoped context via `AsyncLocalStorage`.

## Installation

```bash
npm install @snorreks/firestack
# or
bun add @snorreks/firestack
```

## Quick Start

### 1. Setup Configuration

Create a `firestack.config.ts` (recommended) or `firestack.json` in your project root.

**TypeScript config** — supports path aliases from your `tsconfig.json`:

```ts
// firestack.config.ts
import { defineConfig } from "@snorreks/firestack";
import { defaultRegion } from "@myproject/constants";

export default defineConfig(({ mode }) => ({
  region: defaultRegion,
  modes: {
    development: "my-project-dev",
    production: "my-project-prod",
  },
}));
```

**JSON config** — simple, static:

```json
{
  "$schema": "./node_modules/@snorreks/firestack/firestack.schema.json",
  "modes": {
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

> **Note:** Firestack looks for `firestack.config.ts` first, then falls back to `firestack.json`. If you use the JSON format, the old `flavors` key is still supported for backward compatibility.

## AI Agent Integration (Skill)

If you use AI-powered agents like **OpenCode, Qwen, Claude, or Gemini**, you can install the **Firestack Skill** to give your agent native knowledge of your project's deployment workflows, triggers, and configuration.

### Install the Skill

You can download the [firestack.skill](https://raw.githubusercontent.com/snorreks/firestack/master/firestack.skill) file directly or install it via the command line:

```bash
# 1. Download the skill file
curl -L -O https://raw.githubusercontent.com/snorreks/firestack/master/firestack.skill

# 2. Install to your current project workspace
gemini skills install firestack.skill --scope workspace

# OR Install for all your projects (user scope)
# gemini skills install firestack.skill --scope user
```

### Activate

After installation, run `/skills reload` in your interactive session. Your agent will now understand how to deploy functions, manage emulators, and write v2 triggers according to Firestack standards.

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

### Advanced Function Options

You can customize individual functions by passing options in the second argument of the wrapper:

```typescript
export default onAuthCreate(
  async (user, context) => {
    /* ... */
  },
  {
    functionName: "custom_name", // Override the auto-derived name
    nodeVersion: "20", // Override default Node.js version
    assets: ["src/assets/img.png"], // Copy assets to the function dist
    external: ["is-thirteen"], // Dependencies to keep external
  },
);
```

- **`external`**: Listed dependencies are treated as external by `esbuild`. Firestack automatically generates a `package.json` in the function's deployment directory and runs `npm install` before deployment.
- **`assets`**: Specified files are copied to the function's `dist` directory, making them available at runtime relative to your function code.
- **`nodeVersion`**: Specific runtime version for this function. Useful if certain triggers have different compatibility requirements.
- **`functionName`**: Explicitly name the function in Firebase, bypassing the directory-based naming convention.

### 3. Deploy

```bash
firestack deploy --mode development
```

## Logging & Observability

Firestack provides zero-boilerplate hooks for logging, telemetry, and tracing without being opinionated about which tool you use.

### Request-Scoped Context

Every trigger wrapper (`onRequest`, `onCall`, `onCreated`, `onAuthCreate`, etc.) automatically runs inside an `AsyncLocalStorage` context. You can access and enrich it anywhere in the call stack:

```typescript
import { onRequest, getLogContext, setLogContext } from "@snorreks/firestack";

export default onRequest((request, response) => {
  setLogContext({ userId: request.body.userId, companyId: request.body.companyId });

  const ctx = getLogContext();
  // { source: 'functions', trigger: 'https.onRequest', requestId: '...', userId: '...', companyId: '...' }

  response.send({ ok: true });
});
```

### Auto-Import Init File (`includeFilePath`)

Create `src/logger.ts` (or any custom path). If it exists, Firestack injects an import at the top of every generated function index before any handler code runs. This is the ideal place to initialize your logger, Sentry, or OpenTelemetry:

```typescript
// src/logger.ts
import { getLogContext } from "@snorreks/firestack";
import { getFirestore } from "./configs/database.ts";

const pendingEntries: LogEntry[] = [];

export const logger = {
  info: (message: string, ...data: unknown[]) => {
    pendingEntries.push({ timestamp: new Date(), level: "info", message, data, context: getLogContext() });
    console.log(message, ...data);
  },
  flush: async () => {
    if (pendingEntries.length === 0) return;
    const col = getFirestore().collection("function_logs");
    await Promise.all(pendingEntries.splice(0).map((e) => col.add(e)));
  },
};

process.on("SIGTERM", async () => {
  await logger.flush();
});
```

Configure the path in `firestack.config.ts` or `firestack.json`:

```json
{
  "includeFilePath": "src/logger.ts"
}
```

### `FIRESTACK_FUNCTION_NAME`

Firestack injects the deployed function name as an environment variable. Useful for tagging:

```typescript
const functionName = process.env.FIRESTACK_FUNCTION_NAME;
```

## Configuration

Firestack supports two configuration formats: `firestack.config.ts` (recommended) and `firestack.json`.

### `firestack.config.ts` (Recommended)

Use this format when you need dynamic configuration, TypeScript path aliases from `tsconfig.json`, or computed values.

```ts
// firestack.config.ts
import { defineConfig } from "@snorreks/firestack";
import { defaultRegion } from "@myproject/constants";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    region: isProduction ? "us-east1" : defaultRegion,
    modes: {
      development: "my-project-dev",
      production: "my-project-prod",
    },
    functionsDirectory: "src/controllers",
    rulesDirectory: "src/rules",
    minify: isProduction,
    nodeVersion: "24",
  };
});
```

The `defineConfig` helper accepts either:
- A **static config object**, or
- A **callback** that receives `{ mode }` where `mode` is the value of the `--mode` CLI flag (or the first key in `modes` if not specified).

### `firestack.json`

For simpler projects, use the JSON format:

| Option               | Type     | Default           | Description                                                                           |
| -------------------- | -------- | ----------------- | ------------------------------------------------------------------------------------- |
| `modes`              | object   | `{}`              | Map of mode names to Firebase project IDs.                                            |
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
| `includeFilePath`    | string   | `src/logger.ts`   | File auto-imported into every function index for init (logging, tracing, etc.).      |
| `rulesTests`         | object   | `undefined`       | Configuration for `test:rules` (see Rules Testing below).                             |

> **Backward compatibility:** The old `flavors` key in `firestack.json` is automatically mapped to `modes`.

## Commands & Options

### `firestack deploy`

Builds and deploys functions, rules, and indexes to Firebase.

- `--mode <mode>`: The environment to deploy to.
- `--dry-run`: Show the deployment plan without executing it.
- `--force`: Force deploy all functions, ignoring the cache.
- `--only <names>`: Deploy specific functions (comma-separated). Skips rules automatically.
- `--skip-rules`: Skip deploying rules and indexes.
- `--concurrency <num>`: Parallel deployments (default: `5`).
- `--retryAmount <num>`: Auto-retry failed deployments.
- `--tsconfig <path>`: Path to a custom `tsconfig.json` (e.g., `tsconfig.app.json`).
- `--verbose`: Show detailed Firebase output.

### `firestack emulate`

Starts the Firebase emulator with live reload and real-time UI detection.

- `--open`: Automatically opens the Emulator UI in your browser once it's ready.
- `--watch` / `--no-watch`: Enable/disable file watching for live reload (default: `true`).
- `--init` / `--no-init`: Run/skip the initialization script (default: `true`).
- `--force` / `--no-force`: Kill any existing servers running on emulator ports before starting (default: `false`).
- `--projectId <id>`: Override the Firebase project ID for emulation.
- `--only <services>`: Only start specified services (e.g., `functions,firestore`).
- `--mode <mode>`: The mode context for emulation.
- `--tsconfig <path>`: Path to a custom `tsconfig.json` (e.g., `tsconfig.app.json`).
- `--verbose`: Stream full emulator logs to the console.

### `firestack test:rules`

Tests Firestore and Storage security rules using ephemeral Firebase emulators.

- `--mode <mode>`: The mode to use.
- `--watch`: Watch test files for changes and re-run.
- `--only <targets>`: Only test specific targets (e.g., `firestore,storage`).
- `--verbose`: Show detailed emulator output.

Configure targets in `firestack.config.ts` or `firestack.json`:

```json
{
  "rulesTests": {
    "firestore": {
      "rulesFile": "src/rules/firestore.rules",
      "testPattern": "tests/rules/**/*.rules.test.ts",
      "projectId": "demo-rules-test"
    }
  }
}
```

Write tests using the `@snorreks/firestack/testing` helper:

```typescript
import { describe, test } from "bun:test";
import {
  assertFails,
  assertSucceeds,
  rulesTest,
} from "@snorreks/firestack/testing";

describe("firestore.rules", () => {
  test("unauthenticated user cannot read secrets", async () => {
    const { withoutAuth } = await rulesTest.firestore();
    const db = withoutAuth().firestore();
    await assertFails(db.collection("secrets").doc("x").get());
  });

  test("authenticated user can read own profile", async () => {
    const { withAuth } = await rulesTest.firestore();
    const db = withAuth("user-123").firestore();
    await assertSucceeds(db.collection("users").doc("user-123").get());
  });
});
```

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

- `--mode <mode>`: The mode context for the script.
- `--engine <engine>`: Override the default execution engine.

### `firestack logs`

View Cloud Function logs from the production environment.

- `-n, --lines <num>`: Number of lines to fetch (default: `50`).
- `--since <time>`: Show logs after a specific time (e.g., `1h`, `30m`).
- `--open`: Open the logs in the web browser.

## Advanced Usage

### Emulator Initialization (`on_emulate.ts`)

Automate your setup by seeding the emulator with data. Create a script in your `scriptsDirectory`:

```typescript
// scripts/on_emulate.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firestack runs this script automatically when the emulator starts
const db = getFirestore(
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }),
);
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

export const get: FunctionsCacheGet = async ({ mode }) => {
  // Fetch cached checksums from your remote storage
};

export const update: FunctionsCacheUpdate = async ({
  mode,
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

Deploy them using `firestack rules --mode production`.

## License

MIT
