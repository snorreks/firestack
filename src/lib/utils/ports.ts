import { exec } from 'node:child_process';
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
