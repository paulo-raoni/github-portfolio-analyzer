import { RESET, GRAY, AMBER, GREEN, BLUE, BOLD } from './output.js';
import packageJson from '../../package.json' with { type: 'json' };

const DIM = '\x1b[2m';

const ASCII = `${BLUE}  ◉──●──●──●──◉${RESET}
${DIM}         \\    /${RESET}
${AMBER}          ◉──◉${RESET}
${DIM}            ↓${RESET}
${AMBER}  now  ████ ↑↑↑${RESET}
${AMBER}  next ███░ ↑↑${RESET}
${AMBER}  later█░░░ ↑${RESET}
${DIM}            ↓${RESET}
${GREEN}  ✓ report.json${RESET}`;

export function printHeader({ command: _command, asOfDate, outputDir, hasToken, hasPolicy, version }) {
  const node = process.version;
  const user = process.env.GITHUB_USERNAME ?? '—';
  const token = hasToken ? `${GREEN}✓ set${RESET}` : `${AMBER}not set${RESET}`;
  const policy = hasPolicy ? `${GREEN}✓ set${RESET}` : `${GRAY}not set${RESET}`;
  const ver = version ?? packageJson.version;

  const info = [
    `${BOLD}github-portfolio-analyzer${RESET}`,
    `${GRAY}repo inventory → execution decisions${RESET}`,
    ``,
    `${GRAY}version    ${RESET}${GREEN}${ver}${RESET}`,
    `${GRAY}node       ${RESET}${node}`,
    `${GRAY}user       ${RESET}${user}`,
    `${GRAY}as-of      ${RESET}${asOfDate ?? 'today UTC'}`,
    `${GRAY}output     ${RESET}${outputDir ?? 'output/'}`,
    `${GRAY}token      ${RESET}${token}`,
    `${GRAY}policy     ${RESET}${policy}`,
  ];

  const artLines = ASCII.split('\n');
  const maxLines = Math.max(artLines.length, info.length);

  console.log('');
  for (let i = 0; i < maxLines; i++) {
    const left  = (artLines[i] ?? '').padEnd(26);
    const right = info[i] ?? '';
    console.log(`  ${left}  ${right}`);
  }

  const divider = `${GRAY}${'─'.repeat(56)}${RESET}`;
  console.log(`\n  ${divider}\n`);
}
