import { spawn } from 'node:child_process';

const child = spawn('bun', ['--version'], { stdio: 'inherit' });
child.on('error', (err) => {
  console.error('Failed to spawn bun:', err);
});
child.on('close', (code) => {
  console.log('Bun exited with code:', code);
});
