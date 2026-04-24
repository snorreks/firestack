import { createServer } from 'node:net';

/**
 * Finds an available ephemeral port.
 * @returns A promise that resolves to an available port number.
 */
export const findFreePort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object' && address.port) {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine ephemeral port')));
      }
    });
    server.on('error', (error) => {
      reject(error);
    });
  });
};
