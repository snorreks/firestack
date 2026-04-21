import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '$logger';

const execAsync = promisify(exec);

/**
 * Checks if a port is in use and kills any process using it.
 * @param ports - Ports to check and kill processes on
 * @returns List of ports that had processes killed
 */
export const killProcessesOnPorts = async (ports: number[]): Promise<number[]> => {
  const killedPorts: number[] = [];

  for (const port of ports) {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);

      if (stdout.trim()) {
        const pids = stdout.trim().split('\n').filter(Boolean);

        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            logger.debug(`Killed process ${pid} on port ${port}`);
          } catch {
            logger.debug(`Failed to kill process ${pid} on port ${port}`);
          }
        }

        killedPorts.push(port);
      }
    } catch {
      // No process on this port
    }
  }

  return killedPorts;
};
