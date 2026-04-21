import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const PKG_PATH = join(PROJECT_ROOT, 'package.json');

describe('Build Output Validation', () => {
  test('essential files exist', async () => {
    const files = await readdir(DIST_DIR);
    expect(files).toContain('main.js');
    expect(files).toContain('index.js');
    expect(files).toContain('index.d.ts');
    expect(files).toContain('package.json');
    expect(files).toContain('README.md');
    expect(files).toContain('firestack.schema.json');
  });

  test('main.js has shebang and correct version/commands', async () => {
    const content = await readFile(join(DIST_DIR, 'main.js'), 'utf-8');
    const pkg = JSON.parse(await readFile(PKG_PATH, 'utf-8'));

    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);

    // Validate version matches package.json
    expect(content).toContain(`.version("${pkg.version}")`);

    // Validate commands registration
    expect(content).toContain('.name("firestack")');
    expect(content).toContain('program.addCommand(buildCommand)');
    expect(content).toContain('program.addCommand(deployCommand)');
    expect(content).toContain('program.addCommand(scriptsCommand)');
    expect(content).toContain('program.addCommand(deleteCommand)');
    expect(content).toContain('program.addCommand(emulateCommand)');
    expect(content).toContain('program.addCommand(rulesCommand)');
    expect(content).toContain('program.addCommand(logsCommand)');
    expect(content).toContain('program.parse(process.argv)');
  });

  test('package.json is cleaned', async () => {
    const content = JSON.parse(await readFile(join(DIST_DIR, 'package.json'), 'utf-8'));
    expect(content.scripts).toBeUndefined();
    expect(content.devDependencies).toBeUndefined();
    expect(content.dependencies).toBeDefined();
  });

  test('no path aliases in build output', async () => {
    const aliases = ['$lib', '$constants', '$commands', '$helpers', '$types', '$utils', '$logger'];
    const filesToCheck = ['main.js', 'index.js', 'index.d.ts'];

    for (const file of filesToCheck) {
      const content = await readFile(join(DIST_DIR, file), 'utf-8');
      for (const alias of aliases) {
        const escapedAlias = alias.replace('$', '\\$');
        const regex = new RegExp(`${escapedAlias}([/\\s'"])`, 'g');
        expect(content).not.toMatch(regex);
      }
    }
  });

  test('index.js exports expected functions', async () => {
    const content = await readFile(join(DIST_DIR, 'index.js'), 'utf-8');
    const expectedExports = [
      'FirestackError',
      'HttpStatusCode',
      'HttpsError',
      'beforeAuthCreate',
      'beforeAuthSignIn',
      'createFirestackError',
      'onAuthCreate',
      'onAuthDelete',
      'onCall',
      'onCallZod',
      'onCreated',
      'onCreatedZod',
      'onDeleted',
      'onDeletedZod',
      'onDocumentCreated',
      'onDocumentUpdated',
      'onDocumentDeleted',
      'onDocumentWritten',
      'onObjectArchived',
      'onObjectDeleted',
      'onObjectFinalized',
      'onObjectMetadataUpdated',
      'onRequest',
      'onRequestZod',
      'onSchedule',
      'onUpdated',
      'onUpdatedZod',
      'onValueCreated',
      'onValueDeleted',
      'onValueUpdated',
      'onValueWritten',
      'onWritten',
      'onWrittenZod',
    ];

    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });

  test('index.d.ts exports expected types/functions', async () => {
    const content = await readFile(join(DIST_DIR, 'index.d.ts'), 'utf-8');
    const expectedExports = [
      'beforeAuthCreate',
      'beforeAuthSignIn',
      'createFirestackError',
      'onAuthCreate',
      'onAuthDelete',
      'onCall',
      'onCallZod',
      'onCreated',
      'onCreatedZod',
      'onDeleted',
      'onDeletedZod',
      'onDocumentCreated',
      'onDocumentUpdated',
      'onDocumentDeleted',
      'onDocumentWritten',
      'onObjectArchived',
      'onObjectDeleted',
      'onObjectFinalized',
      'onObjectMetadataUpdated',
      'onRequest',
      'onRequestZod',
      'onSchedule',
      'onUpdated',
      'onUpdatedZod',
      'onValueCreated',
      'onValueDeleted',
      'onValueUpdated',
      'onValueWritten',
      'onWritten',
      'onWrittenZod',
      'HttpsOptions',
      'FirestoreEvent',
      'DocumentOptions',
      'ReferenceOptions',
      'ScheduleOptions',
      'FirestackError',
      'HttpStatusCode',
    ];

    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });

  test('README.md is valid', async () => {
    const content = await readFile(join(DIST_DIR, 'README.md'), 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content.toLowerCase()).toContain('firestack');
  });

  test('firestack.schema.json is valid', async () => {
    const content = JSON.parse(await readFile(join(DIST_DIR, 'firestack.schema.json'), 'utf-8'));
    expect(content.title).toBe('Firestack Configuration');
    expect(content.description).toBeDefined();
    expect(content.type).toBe('object');
    expect(content.properties).toBeDefined();
  });
});
