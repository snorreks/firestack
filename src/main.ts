import { Command } from 'commander';
import { buildCommand } from '$commands/build/index.ts';
import { deleteCommand } from '$commands/delete/index.ts';
import { deployCommand } from '$commands/deploy/index.ts';
import { emulateCommand } from '$commands/emulate/index.ts';
import { logsCommand } from '$commands/logs/index.ts';
import { rulesCommand } from '$commands/rules/index.ts';
import { scriptsCommand } from '$commands/scripts/index.ts';
import { testRulesCommand } from '$commands/test-rules/index.ts';

const program = new Command();

program
  .name('firestack')
  .version('0.0.33')
  .description('CLI for building and deploying Firebase Cloud Functions.');

program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(scriptsCommand);
program.addCommand(deleteCommand);
program.addCommand(emulateCommand);
program.addCommand(rulesCommand);
program.addCommand(logsCommand);
program.addCommand(testRulesCommand);

program.parse(process.argv);
