---
name: firestack
description: CLI for Firebase Cloud Functions (v2). Manages builds, deployments, emulators, and security rules with esbuild and standard TypeScript.
---

# Firestack Skill

## Core Workflows

- **Configuration**: Requires `firestack.json` in root. Define `flavors`, `functionsDirectory`, `rulesDirectory`, and `nodeVersion`.
- **Emulation**: `firestack emulate --flavor <name>`. Use `--open` for UI. Seeds data via `scripts/on_emulate.ts`. Supports `--dry-run` to validate emulator build without starting it.
- **Deployment**: `firestack deploy --flavor <name>`. Supports `--dry-run`, `--force`, and `--only <names>`.
- **Rules**: `firestack rules` deploys Firestore/Storage rules and indexes from `rulesDirectory`.
- **Scripts**: `firestack scripts [name]` runs scripts from `scriptsDirectory` with flavor envs.

## Writing Functions (V2)

**Critical: One Function Per File**
- Each file in the functions directory (e.g., `src/controllers/`) represents **exactly one** Cloud Function.
- The file MUST have an `export default` of a trigger (e.g., `onRequest`, `onCall`, `onDocumentCreated`).
- Multiple function exports in a single file are NOT supported.

### Structure & Naming
- **HTTP**: `api/hello.ts` → `hello`
- **Firestore**: `firestore/users/[uid]/created.ts` → `users_created` (listens on `users/{uid}`)
- **Auth**: `auth/created.ts` → `created` (no prefix for auth)
- **Schedule**: `scheduler/daily.ts` → `daily`

### Example
```typescript
import { onRequest } from "@snorreks/firestack";

export default onRequest((req, res) => {
  res.send({ ok: true });
}, { region: "us-central1", memory: "256MiB" });
```

## References
- [Configuration](references/configuration.md)
- [Triggers](references/triggers.md)
- [Commands](references/commands.md)
