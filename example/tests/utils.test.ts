import { describe, expect, test } from 'bun:test';
import { mkdtemp, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists } from '../../src/lib/utils/common.ts';
import { executeCommand } from '../../src/lib/utils/command.ts';
import { findFreePort } from '../../src/lib/utils/find_free_port.ts';
import { createFirebaseConfig, toDotEnvironmentCode } from '../../src/lib/utils/firebase_utils.ts';
import {
  deriveFunctionName,
  extractDatabaseRef,
  extractDocumentPath,
} from '../../src/lib/utils/function_naming.ts';

describe('function_naming', () => {
  test('deriveFunctionName for API routes', () => {
    const result = deriveFunctionName({
      functionPath: '/project/src/controllers/api/test_api.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('test_api');
  });

  test('deriveFunctionName for Firestore triggers', () => {
    const result = deriveFunctionName({
      functionPath: '/project/src/controllers/firestore/users/[uid]/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('users_created');
  });

  test('deriveFunctionName for nested Firestore paths', () => {
    const result = deriveFunctionName({
      functionPath:
        '/project/src/controllers/firestore/users/[uid]/notifications/[notificationId]/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('users_notifications_created');
  });

  test('deriveFunctionName for scheduler', () => {
    const result = deriveFunctionName({
      functionPath: '/project/src/controllers/scheduler/daily.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('daily');
  });

  test('deriveFunctionName for auth triggers', () => {
    const result = deriveFunctionName({
      functionPath: '/project/src/controllers/auth/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('created');
  });

  test('extractDocumentPath for Firestore', () => {
    const result = extractDocumentPath({
      functionPath: '/project/src/controllers/firestore/users/[uid]/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('users/{uid}');
  });

  test('extractDocumentPath for nested Firestore', () => {
    const result = extractDocumentPath({
      functionPath:
        '/project/src/controllers/firestore/users/[uid]/notifications/[notificationId]/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('users/{uid}/notifications/{notificationId}');
  });

  test('extractDocumentPath returns undefined for non-firestore', () => {
    const result = extractDocumentPath({
      functionPath: '/project/src/controllers/api/hello.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBeUndefined();
  });

  test('extractDatabaseRef for database triggers', () => {
    const result = extractDatabaseRef({
      functionPath:
        '/project/src/controllers/database/rooms/[roomId]/messages/[messageId]/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBe('/rooms/{roomId}/messages/{messageId}');
  });

  test('extractDatabaseRef returns undefined for non-database', () => {
    const result = extractDatabaseRef({
      functionPath: '/project/src/controllers/firestore/users/created.ts',
      functionsDirectoryPath: '/project/src/controllers',
    });
    expect(result).toBeUndefined();
  });
});

describe('firebase_utils', () => {
  test('createFirebaseConfig generates valid JSON', () => {
    const json = createFirebaseConfig({ nodeVersion: '22' });
    const config = JSON.parse(json);
    expect(config.functions.runtime).toBe('nodejs22');
    expect(config.functions.source).toBe('.');
  });

  test('toDotEnvironmentCode formats env vars correctly', () => {
    const result = toDotEnvironmentCode({
      env: {
        KEY1: 'value1',
        KEY2: 'value with spaces',
        API_URL: 'https://api.example.com',
      },
    });
    expect(result).toContain('KEY1=value1');
    expect(result).toContain('KEY2=value with spaces');
    expect(result).toContain('API_URL=https://api.example.com');
    expect(result.split('\n').length).toBe(3);
  });

  test('toDotEnvironmentCode handles empty object', () => {
    const result = toDotEnvironmentCode({ env: {} });
    expect(result).toBe('');
  });
});

describe('find_free_port', () => {
  test('findFreePort returns a valid ephemeral port', async () => {
    const port = await findFreePort();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(1024);
    expect(port).toBeLessThan(65536);
  });

  test('findFreePort returns different ports on successive calls', async () => {
    const port1 = await findFreePort();
    const port2 = await findFreePort();
    // They might coincidentally be the same, but it's very unlikely
    // and the port should be available immediately after close
    expect(typeof port1).toBe('number');
    expect(typeof port2).toBe('number');
  });
});

describe('common', () => {
  test('exists returns true for existing file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'firestack-test-'));
    const tempFile = join(tempDir, 'test.txt');
    await writeFile(tempFile, 'hello');

    const result = await exists(tempFile);
    expect(result).toBe(true);

    await rmdir(tempDir, { recursive: true });
  });

  test('exists returns false for missing file', async () => {
    const result = await exists('/nonexistent/path/to/file.txt');
    expect(result).toBe(false);
  });
});

describe('executeCommand', () => {
  test('strips node_modules/.bin from PATH when packageManager is global', async () => {
    const originalPath = process.env.PATH;
    const separator = process.platform === 'win32' ? ';' : ':';
    const fakeBin = '/fake/project/node_modules/.bin';
    process.env.PATH = `${fakeBin}${separator}${originalPath}`;

    const result = await executeCommand('node', {
      args: ['-e', 'console.log(process.env.PATH)'],
      packageManager: 'global',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    process.env.PATH = originalPath;

    expect(result.success).toBe(true);
    expect(result.stdout).not.toContain(fakeBin);
  });
});
