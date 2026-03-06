import { Command } from 'commander';
import { buildCommand } from '$commands/build.js';
import { deleteCommand } from '$commands/delete/index.js';
import { deployCommand } from '$commands/deploy/index.js';
import { emulateCommand } from '$commands/emulate.js';
import { logsCommand } from '$commands/logs.js';
import { rulesCommand } from '$commands/rules/index.js';
import { scriptsCommand } from '$commands/scripts.js';

const program = new Command();

program
  .name('firestack')
  .version('0.0.18')
  .description('CLI for building and deploying Firebase Cloud Functions.');

program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(scriptsCommand);
program.addCommand(deleteCommand);
program.addCommand(emulateCommand);
program.addCommand(rulesCommand);
program.addCommand(logsCommand);

program.parse(process.argv);
