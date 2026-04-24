# Firestack Configuration

Firestack uses `firestack.json` in the project root to manage flavors, regions, and directories.

## Schema Support
Always add the `$schema` property for autocompletion:
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
  "packageManager": "global",
  "emulators": ["auth", "firestore", "functions", "pubsub", "storage"],
  "rulesTests": {
    "firestore": {
      "rulesFile": "src/rules/firestore.rules",
      "testPattern": "tests/rules/**/*.rules.test.ts",
      "projectId": "demo-rules-test"
    },
    "storage": {
      "rulesFile": "src/rules/storage.rules",
      "testPattern": "tests/storage-rules/**/*.rules.test.ts",
      "projectId": "demo-rules-test"
    }
  }
}
```

## Options Reference

| Option | Default | Description |
| --- | --- | --- |
| `flavors` | `{}` | Map of flavor names to Firebase project IDs. |
| `region` | `us-central1` | Default region for all deployed functions. |
| `functionsDirectory`| `src/controllers` | Where your function controllers are located. |
| `rulesDirectory` | `src/rules` | Where rules and indexes are located. |
| `scriptsDirectory` | `scripts` | Where maintenance/init scripts are located. |
| `initScript` | `on_emulate.ts` | Script to run when the emulator starts. |
| `nodeVersion` | `22` | Node.js version (`18`, `20`, `22`, `24`). |
| `emulators` | `[]` | Explicit list of emulators to enable. |
| `packageManager` | `global` | Manager for `firebase` commands (`npm`, `yarn`, `pnpm`, `bun`, `global`). |
| `rulesTests` | `undefined` | Configuration for `test:rules` (see below). |

## Rules Testing Configuration

The `rulesTests` object configures the `firestack test:rules` command:

```json
{
  "rulesTests": {
    "firestore": {
      "rulesFile": "src/rules/firestore.rules",
      "testPattern": "tests/rules/**/*.rules.test.ts",
      "projectId": "demo-rules-test"
    },
    "storage": {
      "rulesFile": "src/rules/storage.rules",
      "testPattern": "tests/storage-rules/**/*.rules.test.ts",
      "projectId": "demo-rules-test"
    }
  }
}
```

| Property | Required | Description |
| --- | --- | --- |
| `rulesFile` | Yes | Path to the `.rules` file (relative to project root or `rulesDirectory`). |
| `testPattern` | Yes | Glob pattern for test files (e.g., `tests/rules/**/*.rules.test.ts`). |
| `projectId` | No | Project ID for the emulator (default: `firestack-rules-test`). |
