import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..', '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');

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

  test('main.js has shebang', async () => {
    const content = await readFile(join(DIST_DIR, 'main.js'), 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
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
        // Use a more specific check to avoid matching $1, etc.
        // Usually path aliases are followed by / or used in imports/exports
        // But since they start with $, searching for the alias itself is quite safe if we avoid $1, $2

        // We look for the alias as a word (or start of word)
        // regex: \$(lib|constants|commands|helpers|types|utils|logger)(\/|\s|['"])
        const escapedAlias = alias.replace('$', '\\$');
        const regex = new RegExp(`${escapedAlias}([/\\s'"])`, 'g');

        const matches = content.match(regex);
        if (matches) {
          console.error(`Found alias ${alias} in ${file}:`, matches);
        }
        expect(content).not.toMatch(regex);
      }
    }
  });

  test('index.js exports expected functions', async () => {
    const content = await readFile(join(DIST_DIR, 'index.js'), 'utf-8');
    const expectedExports = [
      'onAuthCreate',
      'onAuthDelete',
      'onCall',
      'onDocumentCreated',
      'onDocumentUpdated',
      'onDocumentDeleted',
      'onDocumentWritten',
      'onObjectArchived',
      'onObjectDeleted',
      'onObjectFinalized',
      'onObjectMetadataUpdated',
      'onRequest',
      'onSchedule',
    ];

    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });

  test('index.d.ts exports expected types/functions', async () => {
    const content = await readFile(join(DIST_DIR, 'index.d.ts'), 'utf-8');
    const expectedExports = [
      'declare const onAuthCreate',
      'declare const onCall',
      'declare const onDocumentUpdated',
      'interface HttpsOptions',
    ];

    for (const exp of expectedExports) {
      expect(content).toContain(exp);
    }
  });
});
