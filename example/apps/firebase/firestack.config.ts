import { defineConfig } from '@snorreks/firestack';

export default defineConfig(() => ({
  modes: {
    example: 'aikami-dev',
    development: 'aikami-dev',
  },
  region: 'us-east1',
  minify: false,
  includeFilePath: 'src/configs/logging.ts',
  rulesTests: {
    firestore: {
      rulesFile: 'firestore.rules',
      testPattern: 'tests/rules/firestore.rules.test.ts',
    },
  },
}));
