# `/firestack deploy [flavor]`

Build and deploy Firebase Cloud Functions (and optionally rules) to a specific flavor.

## When to Use

- User says "deploy", "deploy to production", "ship it", "push functions"
- User invokes `/firestack deploy` or `/firestack deploy --flavor production`

## Workflow

### Step 1: Validate Configuration

Read `firestack.json`. If missing, abort and suggest `/firestack setup config`.

Check that `flavors` exists and contains the requested flavor. If the user didn't specify a flavor, ask them to pick one from the available flavors.

### Step 2: Pre-Deploy Check

```bash
# Run a dry-run build to validate everything compiles
firestack deploy --flavor <flavor> --dry-run
```

If this fails, inspect the error output:
- **Type errors** → Fix the source code.
- **Missing dependencies** → Run `bun install` or `npm install`.
- **Invalid firestack.json** → Fix the config.

### Step 3: Confirm Deployment (Destructive)

Show the user what will be deployed:

```
Deploying to: <project-id> (flavor: <flavor>)
Region: <region>
Functions directory: <functionsDirectory>
```

Ask for confirmation before proceeding.

### Step 4: Execute Deployment

```bash
# Standard deploy
firestack deploy --flavor <flavor>

# With specific flags
firestack deploy --flavor <flavor> --force          # Ignore cache, redeploy all
firestack deploy --flavor <flavor> --only func1,func2  # Deploy specific functions
firestack deploy --flavor <flavor> --all            # Deploy functions + rules
firestack deploy --flavor <flavor> --verbose        # Show full Firebase output
```

### Step 5: Post-Deploy Verification

After deployment succeeds:
1. List the deployed function URLs (for HTTP functions):
   ```bash
   firestack logs --flavor <flavor> -n 20
   ```
2. For HTTP functions, the URL format is: `https://<region>-<project-id>.cloudfunctions.net/<function-name>`

## Common Issues

| Issue | Resolution |
|---|---|
| `firebase login required` | Run `firebase login` or `npx firebase login` |
| `functions already exist with different source` | Use `--force` to overwrite |
| `esbuild error` | Check for TypeScript errors in the function source |
| `external dependency not found` | Add it to `external` in function options or global `external` in `firestack.json` |
| `assets not found` | Ensure asset paths are relative to project root |

## Full Flag Reference

| Flag | Description |
|---|---|
| `--flavor <flavor>` | Target environment (required). |
| `--dry-run` | Validate build without deploying. |
| `--force` | Redeploy all functions, ignore cache. |
| `--only <names>` | Comma-separated list of specific functions. |
| `--all` | Deploy both functions AND rules. |
| `--concurrency <num>` | Parallel deployments (default: `5`). |
| `--retryAmount <num>` | Auto-retry failed deployments. |
| `--verbose` | Show full Firebase CLI output. |
