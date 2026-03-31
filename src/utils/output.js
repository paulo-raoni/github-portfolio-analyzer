export const RESET  = '\x1b[0m';
export const GRAY   = '\x1b[90m';
export const AMBER  = '\x1b[33m';
export const GREEN  = '\x1b[32m';
export const RED    = '\x1b[31m';
export const BLUE   = '\x1b[34m';
export const BOLD   = '\x1b[1m';

export function info(msg)     { console.log(`${GRAY}${msg}${RESET}`); }
export function progress(msg) { console.log(`${AMBER}${msg}${RESET}`); }
export function success(msg)  { console.log(`${GREEN}${msg}${RESET}`); }
export function error(msg)    { console.error(`${RED}${msg}${RESET}`); }
export function warn(msg)     { console.log(`${AMBER}⚠ ${msg}${RESET}`); }
export function fatal(msg)    { console.error(`${RED}✗ ${msg}${RESET}`); }
export function dim(msg)      { process.stdout.write(`${GRAY}${msg}${RESET}`); }
