import { Command } from 'commander';
import { buildCommand } from './lib/commands/build.js';
import { deleteCommand } from './lib/commands/delete.js';
import { deployCommand } from './lib/commands/deploy/index.js';
import { emulateCommand } from './lib/commands/emulate.js';
import { logsCommand } from './lib/commands/logs.js';
import { rulesCommand } from './lib/commands/rules.js';
import { scriptsCommand } from './lib/commands/scripts.js';

const program = new Command();

program
  .name('firestack')
  .version('1.0.0')
  .description('CLI for building and deploying Firebase Cloud Functions.');

program.addCommand(buildCommand);
program.addCommand(deployCommand);
program.addCommand(scriptsCommand);
program.addCommand(deleteCommand);
program.addCommand(emulateCommand);
program.addCommand(rulesCommand);
program.addCommand(logsCommand);

program.parse(process.argv);
