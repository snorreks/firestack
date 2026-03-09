import { Command } from 'commander';
import { buildCommand } from '$commands/build.ts';
import { deleteCommand } from '$commands/delete/index.ts';
import { deployCommand } from '$commands/deploy/index.ts';
import { emulateCommand } from '$commands/emulate.ts';
import { logsCommand } from '$commands/logs.ts';
import { rulesCommand } from '$commands/rules/index.ts';
import { scriptsCommand } from '$commands/scripts.ts';

const program = new Command();

program
  .name('firestack')
  .version('0.0.25')
  .description('CLI for building and deploying Firebase Cloud Functions.');

program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(scriptsCommand);
program.addCommand(deleteCommand);
program.addCommand(emulateCommand);
program.addCommand(rulesCommand);
program.addCommand(logsCommand);

program.parse(process.argv);
