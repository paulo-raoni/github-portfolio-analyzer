import path from 'node:path';
import { ensureDirectory, writeTextFile } from './files.js';

export async function writeProjectMarkdownFiles(outputDir, items) {
  const projectsDir = path.join(outputDir, 'projects');
  await ensureDirectory(projectsDir);

  const assigned = new Set();

  for (const item of items) {
    const fileSlug = uniqueSlug(item.slug, item.type, assigned);
    const filePath = path.join(projectsDir, `${fileSlug}.md`);
    const content = renderProjectMarkdown(item);
    await writeTextFile(filePath, content);
  }
}

export async function writePortfolioSummary(outputDir, payload) {
  const summaryPath = path.join(outputDir, 'portfolio-summary.md');
  await writeTextFile(summaryPath, renderPortfolioSummary(payload));
  return summaryPath;
}

function renderProjectMarkdown(item) {
  const name = item.title ?? item.fullName ?? item.name ?? item.slug;
  const lines = [
    `# ${name}`,
    '',
    '## Metadata',
    `- type: ${item.type}`,
    `- category: ${item.category}`,
    `- state: ${item.state}`,
    `- strategy: ${item.strategy}`,
    `- effort: ${item.effort}`,
    `- value: ${item.value}`,
    `- score: ${item.score ?? 0}`,
    `- nextAction: ${item.nextAction}`,
    ''
  ];

  if (item.type === 'repo') {
    lines.push('## Repository');
    lines.push(`- fullName: ${item.fullName}`);
    lines.push(`- url: ${item.htmlUrl ?? 'n/a'}`);
    lines.push(`- language: ${item.language ?? 'n/a'}`);
    lines.push(`- activity: ${item.activity ?? 'n/a'}`);
    lines.push(`- maturity: ${item.maturity ?? 'n/a'}`);
    lines.push('');

    if (item.structuralHealth) {
      lines.push('## Structural Health');
      lines.push(`- README: ${item.structuralHealth.hasReadme}`);
      lines.push(`- LICENSE: ${item.structuralHealth.hasLicense}`);
      lines.push(`- package.json: ${item.structuralHealth.hasPackageJson}`);
      lines.push(`- tests: ${item.structuralHealth.hasTests}`);
      lines.push(`- CI: ${item.structuralHealth.hasCi}`);
      lines.push('');
    }
  }

  if (item.type === 'idea') {
    lines.push('## Idea');
    lines.push(`- status: ${item.status ?? 'draft'}`);
    lines.push(`- targetUser: ${item.targetUser ?? 'n/a'}`);
    lines.push(`- problem: ${item.problem ?? 'n/a'}`);
    lines.push(`- scope: ${item.scope ?? 'n/a'}`);
    lines.push(`- mvp: ${item.mvp ?? 'n/a'}`);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function renderPortfolioSummary(payload) {
  const { generatedAt, asOfDate, items } = payload;
  const repos = items.filter((item) => item.type === 'repo');
  const ideas = items.filter((item) => item.type === 'idea');

  const lines = [
    '# Portfolio Summary',
    '',
    `- generatedAt: ${generatedAt}`,
    `- asOfDate: ${asOfDate ?? 'null'}`,
    `- totalProjects: ${items.length}`,
    `- repositories: ${repos.length}`,
    `- ideas: ${ideas.length}`,
    '',
    '## Top 10 by score',
    ''
  ];

  const topTen = [...items]
    .sort((left, right) => {
      if ((right.score ?? 0) !== (left.score ?? 0)) {
        return (right.score ?? 0) - (left.score ?? 0);
      }
      return left.slug.localeCompare(right.slug);
    })
    .slice(0, 10);

  if (topTen.length === 0) {
    lines.push('- No projects available.');
  } else {
    topTen.forEach((item, index) => {
      const label = item.title ?? item.fullName ?? item.name ?? item.slug;
      lines.push(`${index + 1}. ${label} (${item.type}) — score ${item.score ?? 0}, state ${item.state}`);
    });
  }

  lines.push('');

  for (const state of ['active', 'stale', 'dormant', 'abandoned', 'idea']) {
    lines.push(`## State: ${state}`);
    lines.push('');

    const scoped = items.filter((item) => item.state === state);
    if (scoped.length === 0) {
      lines.push('- None');
    } else {
      scoped.forEach((item) => {
        const label = item.title ?? item.fullName ?? item.name ?? item.slug;
        lines.push(`- ${label} (${item.type}) — score ${item.score ?? 0}`);
      });
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function uniqueSlug(slug, type, assigned) {
  let candidate = slug;
  if (!assigned.has(candidate)) {
    assigned.add(candidate);
    return candidate;
  }

  candidate = `${slug}-${type}`;
  if (!assigned.has(candidate)) {
    assigned.add(candidate);
    return candidate;
  }

  let index = 2;
  while (assigned.has(`${candidate}-${index}`)) {
    index += 1;
  }

  const finalValue = `${candidate}-${index}`;
  assigned.add(finalValue);
  return finalValue;
}
