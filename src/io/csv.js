import path from 'node:path';
import { writeTextFile } from './files.js';

export async function writeInventoryCsv(outputDir, items) {
  const filePath = path.join(outputDir, 'inventory.csv');
  const header = [
    'id',
    'fullName',
    'type',
    'private',
    'archived',
    'language',
    'stargazersCount',
    'sizeKb',
    'activity',
    'maturity',
    'score',
    'state',
    'strategy',
    'effort',
    'value',
    'nextAction'
  ];

  const rows = [header.join(',')];

  for (const item of items) {
    const row = [
      item.id,
      item.fullName,
      item.type,
      item.private,
      item.archived,
      item.language ?? '',
      item.stargazersCount ?? 0,
      item.sizeKb ?? 0,
      item.activity ?? '',
      item.maturity ?? '',
      item.score ?? 0,
      item.state ?? '',
      item.strategy ?? '',
      item.effort ?? '',
      item.value ?? '',
      item.nextAction ?? ''
    ].map(csvEscape);

    rows.push(row.join(','));
  }

  await writeTextFile(filePath, `${rows.join('\n')}\n`);
  return filePath;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}
