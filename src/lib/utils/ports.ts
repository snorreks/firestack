import { exec } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { logger } from '$logger';
import type { FirebaseEmulator } from '$types';

const execAsync = promisify(exec);

const isLinux = platform() === 'linux';
const isMacos = platform() === 'darwin';

/**
 * Default port for each emulator, matching firebase-tools' defaults.
 */
export const defaultPorts: Partial<Record<FirebaseEmulator, number>> = {
  ui: 4000,
  hub: 4400,
  auth: 9099,
  functions: 5001,
  firestore: 8080,
  pubsub: 8085,
  storage: 9199,
  database: 9000,
  hosting: 5000,
  dataconnect: 9399,
};

/**
 * Environment variable per emulator that overrides its port. Lets a second
 * emulator suite run from the same project directory with per-process env
 * (e.g. herdr/overmind) without touching the shared firestack config.
 */
const EMULATOR_PORT_ENV_KEYS: Record<string, string> = {
  ui: 'FIRESTACK_EMULATOR_UI_PORT',
  hub: 'FIRESTACK_EMULATOR_HUB_PORT',
  auth: 'FIRESTACK_EMULATOR_AUTH_PORT',
  functions: 'FIRESTACK_EMULATOR_FUNCTIONS_PORT',
  firestore: 'FIRESTACK_EMULATOR_FIRESTORE_PORT',
  pubsub: 'FIRESTACK_EMULATOR_PUBSUB_PORT',
  storage: 'FIRESTACK_EMULATOR_STORAGE_PORT',
  database: 'FIRESTACK_EMULATOR_DATABASE_PORT',
  hosting: 'FIRESTACK_EMULATOR_HOSTING_PORT',
  dataconnect: 'FIRESTACK_EMULATOR_DATACONNECT_PORT',
};

type ResolveEmulatorPortOptions = {
  emulatorName: FirebaseEmulator;
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
};

/**
 * Resolves the port for a single emulator.
 * Precedence: `FIRESTACK_EMULATOR_<NAME>_PORT` env override → explicit
 * `emulatorPorts.<name>` config → firebase-tools' default port.
 * @param options - Emulator name and optional explicit port map.
 * @returns The resolved port, or undefined when neither config nor default
 * exists for the emulator (e.g. `eventarc`).
 */
export const resolveEmulatorPort = (options: ResolveEmulatorPortOptions): number | undefined => {
  const { emulatorName, emulatorPorts } = options;

  const envKey = EMULATOR_PORT_ENV_KEYS[emulatorName];
  if (envKey) {
    const envPort = Number(process.env[envKey]);
    if (Number.isInteger(envPort) && envPort > 0) {
      return envPort;
    }
  }

  return emulatorPorts?.[emulatorName] ?? defaultPorts[emulatorName];
};

type ResolveHubPortOptions = {
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
};

/**
 * Resolves the emulator hub port for this suite.
 * Precedence: `FIRESTACK_EMULATOR_HUB_PORT` env override → explicit
 * `emulatorHub` key (legacy alias) → `hub` → firebase-tools' default 4400.
 * @param options - Optional explicit port map.
 * @returns The resolved hub port.
 */
export const resolveHubPort = (options: ResolveHubPortOptions): number => {
  const { emulatorPorts } = options;

  const envPort = Number(process.env.FIRESTACK_EMULATOR_HUB_PORT);
  if (Number.isInteger(envPort) && envPort > 0) {
    return envPort;
  }

  const legacyPort = emulatorPorts?.emulatorHub;
  if (typeof legacyPort === 'number' && legacyPort > 0) {
    return legacyPort;
  }

  return resolveEmulatorPort({ emulatorName: 'hub', emulatorPorts }) ?? defaultPorts.hub ?? 4400;
};

type ResolveCleanupPortsOptions = {
  enabledEmulators: Set<FirebaseEmulator>;
  emulatorPorts?: Partial<Record<FirebaseEmulator, number>>;
};

/**
 * Computes the ports this suite is actually about to bind: the UI, every
 * enabled emulator, and the hub. Used for `--force` cleanup and shutdown so
 * firestack never kills processes on ports it is not going to use — other
 * emulator suites (e.g. a concurrent contract run) may own those ports, and
 * killing them would take down unrelated work.
 * @param options - The emulators enabled for this suite and the explicit port map.
 * @returns The list of ports to free.
 */
export const resolveCleanupPorts = (options: ResolveCleanupPortsOptions): number[] => {
  const { enabledEmulators, emulatorPorts } = options;

  const ports: number[] = [
    resolveEmulatorPort({ emulatorName: 'ui', emulatorPorts }) ?? defaultPorts.ui ?? 4000,
  ];

  for (const emulatorName of enabledEmulators) {
    const port = resolveEmulatorPort({ emulatorName, emulatorPorts });
    if (port !== undefined) {
      ports.push(port);
    }
  }

  ports.push(resolveHubPort({ emulatorPorts }));

  return ports;
};

/**
 * Kills any process using the specified port.
 * Uses platform-specific commands: fuser on Linux, lsof/kill on macOS, netstat/taskkill on Windows.
 * @param port - The port number to free.
 * @returns True if a process was killed, false otherwise.
 */
const killOnPort = async (port: number): Promise<boolean> => {
  try {
    if (isLinux) {
      await execAsync(`fuser -k ${port}/tcp`);
    } else if (isMacos) {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      if (stdout.trim()) {
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid}`);
        }
      }
    } else {
      // Windows - use netstat
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const match = stdout.match(/LISTENING\s+(\d+)/);
      if (match) {
        // /T kills child processes too (Java emulators are children of the CLI)
        await execAsync(`taskkill /F /T /PID ${match[1]}`);
      }
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if a port is in use and kills any process using it.
 * @param ports - Ports to check and kill processes on
 * @returns List of ports that had processes killed
 */
export const killProcessesOnPorts = async (ports: number[]): Promise<number[]> => {
  const killedPorts: number[] = [];

  for (const port of ports) {
    const killed = await killOnPort(port);
    if (killed) {
      logger.debug(`Killed process on port ${port}`);
      killedPorts.push(port);
    }
  }

  return killedPorts;
};

/** Emulator process name patterns to kill (Linux: pgrep -f, macOS: pgrep -f). */
const EMULATOR_PROCESS_PATTERNS = [
  'cloud-firestore-emulator',
  'dataconnect-emulator',
  'firebase.*emulators:start',
];

/**
 * Comprehensive emulator cleanup: kills processes by port, by name pattern,
 * and removes the hub locator file. Prevents stale Java/Node processes from
 * surviving between emulator runs.
 *
 * @param ports - Known emulator TCP ports to free.
 * @param projectId - Firebase project ID (to clear hub locator).
 */
export const forceCleanupEmulators = async (ports: number[], projectId?: string): Promise<void> => {
  // 1. Kill by port (fastest, most reliable)
  logger.debug('Cleaning up emulator ports...');
  const killed = await killProcessesOnPorts(ports);
  if (killed.length > 0) {
    logger.debug(`Killed processes on ports: ${killed.join(', ')}`);
  }

  // 2. Kill by process name pattern (catches processes not yet bound to a port,
  //    or zombie emulator children that survived fuser)
  if (isLinux || isMacos) {
    for (const pattern of EMULATOR_PROCESS_PATTERNS) {
      try {
        const { stdout } = await execAsync(`pgrep -f '${pattern}'`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length > 0) {
          logger.debug(`Killing ${pids.length} ${pattern} process(es): ${pids.join(', ')}`);
          for (const pid of pids) {
            try {
              await execAsync(`kill -9 ${pid}`);
            } catch {
              /* process already gone */
            }
          }
        }
      } catch {
        /* no matching processes — expected */
      }
    }
  }

  // 3. Remove hub locator file (otherwise firebase-tools complains about
  //    "port is already in use for another project")
  if (projectId) {
    const hubPath = join(tmpdir(), `hub-${projectId}.json`);
    try {
      await unlink(hubPath);
      logger.debug(`Removed hub locator: ${hubPath}`);
    } catch {
      /* file didn't exist or already removed */
    }
  }

  // 4. Brief pause to let OS release ports
  await new Promise((resolve) => setTimeout(resolve, 500));
};
