#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
});
