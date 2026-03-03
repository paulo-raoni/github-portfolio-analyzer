import path from 'node:path';
import { writeJsonFile, writeTextFile } from './files.js';
import { effortOrder, stateOrder } from '../core/report.js';

export async function writeReportJson(outputDir, model) {
  const filePath = path.join(outputDir, 'portfolio-report.json');
  await writeJsonFile(filePath, model);
  return filePath;
}

export async function writeReportMarkdown(outputDir, model) {
  const filePath = path.join(outputDir, 'portfolio-report.md');
  await writeTextFile(filePath, renderReportMarkdown(model));
  return filePath;
}

export async function writeReportAscii(outputDir, model) {
  const filePath = path.join(outputDir, 'portfolio-report.txt');
  await writeTextFile(filePath, renderReportAscii(model));
  return filePath;
}

export function renderReportAscii(model) {
  const lines = [];

  lines.push('Portfolio Decision Report');
  lines.push('=========================');
  lines.push(`Generated: ${model.meta.generatedAt}`);
  lines.push(`As-of date: ${model.meta.asOfDate ?? 'null'}`);
  lines.push(`Owner: ${model.meta.owner ?? 'null'}`);
  lines.push(`Counts: total ${model.meta.counts.total}, repos ${model.meta.counts.repos}, ideas ${model.meta.counts.ideas}`);
  lines.push('');
  lines.push(`State bar: ${buildStateBarLine(model.summary.byState)}`);
  lines.push('');
  lines.push('Completion x Effort Matrix');
  lines.push('--------------------------');
  lines.push(renderAsciiMatrix(model.matrix.completionByEffort));
  lines.push('');

  lines.push(...renderAsciiBandSection('NOW', model.summary.now));
  lines.push(...renderAsciiBandSection('NEXT', model.summary.next));
  lines.push(...renderAsciiBandSection('LATER', model.summary.later));
  lines.push(...renderAsciiBandSection('PARK', model.summary.park));

  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderReportMarkdown(model) {
  const lines = [];

  lines.push('# Portfolio Decision Report');
  lines.push('');
  lines.push(`- Generated: ${model.meta.generatedAt}`);
  lines.push(`- As-of date: ${model.meta.asOfDate ?? 'null'}`);
  lines.push(`- Owner: ${model.meta.owner ?? 'null'}`);
  lines.push(`- Counts: total ${model.meta.counts.total}, repos ${model.meta.counts.repos}, ideas ${model.meta.counts.ideas}`);
  lines.push('');

  lines.push('## State Bar');
  lines.push('');
  lines.push(buildStateBarLine(model.summary.byState));
  lines.push('');

  lines.push('## Top 10 by Score');
  lines.push('');
  lines.push('| # | Slug | Type | Score | State | Effort Estimate | Value | CL | Priority | Next Action |');
  lines.push('|---|------|------|-------|-------|-----------------|-------|----|----------|-------------|');

  const top10 = model.summary.top10ByScore;
  if (top10.length === 0) {
    lines.push('| 1 | - | - | - | - | - | - | - | - | - |');
  } else {
    top10.forEach((item, index) => {
      lines.push(`| ${index + 1} | ${escapeCell(item.slug)} | ${item.type} | ${item.score} | ${item.state} | ${item.effortEstimate} | ${item.value} | ${item.completionLevel} | ${item.priorityBand} | ${escapeCell(item.nextAction)} |`);
    });
  }

  lines.push('');
  lines.push('## Completion x Effort Matrix');
  lines.push('');
  lines.push('| Level | xs | s | m | l | xl |');
  lines.push('|-------|----|---|---|---|----|');

  for (let level = 0; level <= 5; level += 1) {
    const key = `CL${level}`;
    const row = model.matrix.completionByEffort[key];
    lines.push(`| ${key} | ${row.xs} | ${row.s} | ${row.m} | ${row.l} | ${row.xl} |`);
  }

  lines.push('');
  lines.push(...renderMarkdownBandSection('NOW', model.summary.now));
  lines.push(...renderMarkdownBandSection('NEXT', model.summary.next));
  lines.push(...renderMarkdownBandSection('LATER', model.summary.later));
  lines.push(...renderMarkdownBandSection('PARK', model.summary.park));

  return `${lines.join('\n').trimEnd()}\n`;
}

function renderAsciiBandSection(title, items) {
  const lines = [];
  lines.push(`${title}`);
  lines.push('-'.repeat(title.length));

  if (items.length === 0) {
    lines.push('None');
    lines.push('');
    return lines;
  }

  items.slice(0, 5).forEach((item, index) => {
    lines.push(`${index + 1}) ${item.slug} — Score ${item.score} — CL${item.completionLevel} — Effort ${item.effortEstimate} — State ${item.state}`);
    lines.push(`   Why: ${item.priorityWhy?.join('; ') ?? ''}`);
    lines.push(`   Next: ${item.nextAction}`);
  });

  lines.push('');
  return lines;
}

function renderMarkdownBandSection(title, items) {
  const lines = [];
  lines.push(`## ${title}`);
  lines.push('');

  if (items.length === 0) {
    lines.push('- None');
    lines.push('');
    return lines;
  }

  items.slice(0, 5).forEach((item, index) => {
    lines.push(`${index + 1}. **${item.slug}** — Score ${item.score} — CL${item.completionLevel} — Effort ${item.effortEstimate} — State ${item.state}`);
    lines.push(`   - Why: ${item.priorityWhy?.join('; ') ?? ''}`);
    lines.push(`   - Next: ${item.nextAction}`);
  });

  lines.push('');
  return lines;
}

function buildStateBarLine(byState) {
  const states = stateOrder();
  const counts = states.map((state) => Number(byState[state] ?? 0));
  const maxCount = Math.max(1, ...counts);

  const segments = states.map((state) => {
    const count = Number(byState[state] ?? 0);
    const blocks = count <= 0 ? '' : '█'.repeat(Math.max(1, Math.round((count / maxCount) * 8)));
    return `${state} ${blocks} ${count}`.replace(/\s+/g, ' ').trim();
  });

  return segments.join(' | ');
}

function renderAsciiMatrix(matrix) {
  const effortKeys = effortOrder();
  const header = ['Level', ...effortKeys.map((effort) => effort.toUpperCase())];
  const widths = [5, 4, 4, 4, 4, 4];

  const rows = [];
  rows.push(formatRow(header, widths));
  rows.push(formatRow(widths.map((width) => '-'.repeat(width)), widths));

  for (let level = 0; level <= 5; level += 1) {
    const key = `CL${level}`;
    const row = matrix[key] ?? { xs: 0, s: 0, m: 0, l: 0, xl: 0 };
    rows.push(
      formatRow(
        [key, String(row.xs), String(row.s), String(row.m), String(row.l), String(row.xl)],
        widths
      )
    );
  }

  return rows.join('\n');
}

function formatRow(cells, widths) {
  return cells
    .map((cell, index) => String(cell).padEnd(widths[index], ' '))
    .join(' ')
    .trimEnd();
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|');
}
