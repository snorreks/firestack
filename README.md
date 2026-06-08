# firestack<!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/@snorreks/firestack)](https://www.npmjs.com/package/@snorreks/firestack)

Firestack is a CLI tool for building, testing, and deploying Firebase Cloud Functions v2. Write functions in TypeScript, deploy to Google Cloud Functions with esbuild, and run everything locally with the Firebase emulator.

## Features

- **TypeScript-first** — Modern TS with path aliases, typed triggers, Zod validation
- **Auto-discovery** — File structure determines function names and trigger types
- **All v2 providers** — Every Firebase v2 trigger is supported (14 builders, 40+ triggers)
- **Emulator** — Live reload, auto-open UI, init scripts, zero-config rules testing
- **Multi-mode** — Development, staging, production with per-mode project IDs
- **Differential deploys** — Local + remote checksum caching, parallel deployments
- **Batch concurrency** — Queue async side-effects that run concurrently post-handler
- **Observability** — `AsyncLocalStorage` context, auto-import logger, `FIRESTACK_FUNCTION_NAME`

## Quick Start

```bash
npm install @snorreks/firestack
```

Create `firestack.config.ts`:

```ts
import { defineConfig } from "@snorreks/firestack";

export default defineConfig({
  modes: {
    development: "my-project-dev",
    production: "my-project-prod",
  },
  region: "us-central1",
  functionsDirectory: "src/controllers",
  nodeVersion: "24",
});
```

Write a function in `src/controllers/api/hello.ts`:

```ts
import { onRequest } from "@snorreks/firestack";

export default onRequest(
  (req, res) => res.send({ message: "Hello from Firestack!" }),
  { region: "us-central1", memory: "256MiB" }
);
```

Deploy:

```bash
firestack deploy --mode development
```

Run locally:

```bash
firestack emulate --mode development --open
```

## Trigger Directory Convention

| Directory | Triggers |
|---|---|
| `api/` | `onRequest`, `onRequestZod` |
| `callable/` | `onCall`, `onCallZod` |
| `firestore/` | `onDocumentCreated`, `onDocumentDeleted`, `onDocumentUpdated`, `onDocumentWritten`, typed/Zod variants |
| `auth/` | `onAuthCreate`, `onAuthDelete`, `beforeAuthCreate`, `beforeAuthSignIn` |
| `identity/` | `beforeUserCreated`, `beforeUserSignedIn`, `beforeEmailSent`, `beforeSmsSent` |
| `storage/` | `onObjectFinalized`, `onObjectDeleted`, `onObjectArchived`, `onObjectMetadataUpdated` |
| `scheduler/` | `onSchedule` |
| `database/` | `onValueCreated`, `onValueUpdated`, `onValueDeleted`, `onValueWritten` |
| `pubsub/` | `onMessagePublished` |
| `tasks/` | `onTaskDispatched` |
| `eventarc/` | `onCustomEventPublished` |
| `test_lab/` | `onTestMatrixCompleted` |
| `remote_config/` | `onConfigUpdated` |
| `alerts/` | `onNewFatalIssuePublished`, `onNewNonfatalIssuePublished`, `onRegressionAlertPublished`, `onStabilityDigestPublished`, `onVelocityAlertPublished`, `onNewAnrIssuePublished`, `onThresholdAlertPublished`, `onPlanUpdatePublished`, `onPlanAutomatedUpdatePublished`, `onNewTesterIosDevicePublished`, `onInAppFeedbackPublished` |
| `ai/` | `beforeGenerateContent`, `afterGenerateContent` |

**[See the example project](example/)** for working controllers with batch concurrency, assets, external deps, and full mode configuration.

## Configuration

| Option | Default | Description |
|---|---|---|
| `modes` | `{}` | Mode names → Firebase project IDs |
| `region` | `us-central1` | Default region |
| `functionsDirectory` | `src/controllers` | Controller root |
| `rulesDirectory` | `src/rules` | Rules and indexes |
| `scriptsDirectory` | `scripts` | Custom scripts |
| `nodeVersion` | `22` | Runtime (`20`, `22`, `24`) |
| `engine` | `bun` | Execution engine |
| `packageManager` | `global` | Firebase CLI host (`npm`, `yarn`, `pnpm`, `bun`, `global`) |
| `minify` | `true` | Minify output |
| `sourcemap` | `true` | Generate sourcemaps |
| `external` | `[]` | Dependencies kept external |
| `includeFilePath` | `src/logger.ts` | Auto-imported into every function |

## Commands

| Command | Description |
|---|---|
| `deploy [mode]` | Build and deploy functions, rules, and indexes |
| `emulate [mode]` | Start emulators with live reload |
| `sync [mode]` | Pull rules and indexes from Firebase |
| `generate` | Generate Data Connect SDKs |
| `test:rules [mode]` | Test Firestore/Storage rules |
| `rules` | Deploy rules and indexes |
| `delete` | Remove unused functions |
| `logs` | View Cloud Function logs |
| `scripts [name]` | Run custom scripts |

Common flags: `--mode`, `--dry-run`, `--only`, `--force`, `--verbose`, `--tsconfig`.

## Rules Testing

```ts
// firestack.config.ts
export default defineConfig({
  rulesTests: {
    firestore: {
      rulesFile: "src/rules/firestore.rules",
      testPattern: "tests/rules/**/*.rules.test.ts",
    },
  },
});
```

```ts
import { assertFails, assertSucceeds, rulesTest } from "@snorreks/firestack/testing";

describe("firestore.rules", () => {
  test("unauthenticated user cannot read secrets", async () => {
    const { withoutAuth } = await rulesTest.firestore();
    const db = withoutAuth().firestore();
    await assertFails(db.collection("secrets").doc("x").get());
  });
});
```

## AI Agent Skill

Install the Firestack skill for AI agents (Claude, Gemini, OpenCode):

```bash
curl -L -O https://raw.githubusercontent.com/snorreks/firestack/master/firestack.skill
gemini skills install firestack.skill --scope workspace
```

Run `/skills reload` to activate. The agent gains knowledge of all commands, triggers, and deployment workflows.

## License

MIT
