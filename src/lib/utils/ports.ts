import { exec } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { platform } from 'node:os';
import { promisify } from 'node:util';
import { logger } from '$logger';

const execAsync = promisify(exec);

const isLinux = platform() === 'linux';
const isMacos = platform() === 'darwin';

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
        await execAsync(`taskkill /F /PID ${match[1]}`);
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
    const hubPath = `/tmp/hub-${projectId}.json`;
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
