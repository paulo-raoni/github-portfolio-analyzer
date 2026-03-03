# github-portfolio-analyzer

`github-portfolio-analyzer` is a production-oriented Node.js CLI that builds portfolio intelligence from two streams:

1. Existing GitHub repositories (via GitHub API)
2. Manual project ideas that are not repositories yet

It produces deterministic portfolio artifacts for planning, prioritization, and reporting.

## Requirements

- Node.js 22+ (latest LTS in this dev container)
- A GitHub Personal Access Token for `analyze`

## Installation

```bash
npm install
```

Run directly:

```bash
node bin/github-portfolio-analyzer.js --help
```

Or link globally in your environment:

```bash
npm link
github-portfolio-analyzer --help
```

## Environment

Create `.env` based on `.env.example`:

```bash
cp .env.example .env
```

Variables:

- `GITHUB_TOKEN` (required for `analyze`)
- `GITHUB_USERNAME` (optional)

If `GITHUB_TOKEN` is missing, `analyze` exits with a clear error. `ingest-ideas` and `build-portfolio` still work.

## Commands

### 1) Analyze GitHub repositories

```bash
github-portfolio-analyzer analyze --as-of 2026-03-03
```

Options:

- `--as-of YYYY-MM-DD` optional snapshot date (UTC). If omitted, UTC today is computed once at runtime.
- `--output-dir PATH` optional output directory (default: `output`).

What it does:

- Authenticates with GitHub API
- Fetches all repositories with pagination
- Performs structural checks (README, LICENSE, package.json, tests, CI)
- Classifies activity and maturity
- Scores repositories (0..100)
- Applies taxonomy defaults/inference and provenance metadata
- Writes:
  - `output/inventory.json`
  - `output/inventory.csv`

### 2) Ingest project ideas

From JSON file (default `ideas/input.json`):

```bash
github-portfolio-analyzer ingest-ideas
```

With explicit file:

```bash
github-portfolio-analyzer ingest-ideas --input ./ideas/input.json
```

Interactive prompt:

```bash
github-portfolio-analyzer ingest-ideas --prompt
```

What it does:

- Normalizes idea records
- Upserts ideas by slug
- Scores ideas (0..100)
- Maps `status` to taxonomy `state`
- Validates/normalizes `nextAction`
- Writes `output/ideas.json`

### 3) Build merged portfolio

```bash
github-portfolio-analyzer build-portfolio
```

Options:

- `--output-dir PATH` optional output directory (default: `output`).

What it does:

- Merges repos + ideas into one source of truth
- Preserves deterministic sorting
- Generates per-project markdown pages
- Generates summary report with state sections and top scores
- Writes:
  - `output/portfolio.json`
  - `output/projects/*.md`
  - `output/portfolio-summary.md`

### 4) Generate decision-oriented reports

```bash
github-portfolio-analyzer report --format all
```

Options:

- `--output-dir PATH` optional output directory (default: `output`).
- `--format VALUE` report format: `ascii | md | json | all` (default: `all`).

What it does:

- Reads `output/portfolio.json` (required)
- Optionally reads `output/inventory.json` for repo-specific completion signals
- Computes completion levels, effort estimates, and priority bands
- Writes:
  - `output/portfolio-report.json`
  - `output/portfolio-report.md`
  - `output/portfolio-report.txt`

## Input and Output Contracts

### Ideas input (`ideas/input.json`)

`ideas/input.json` must be a JSON array. Example fields:

- `title` (required)
- `problem`, `scope`, `targetUser`, `mvp` (optional)
- `nextAction` (optional)
- `status`, `tags` (optional)
- optional taxonomy overrides: `category`, `state`, `strategy`, `effort`, `value`

### Taxonomy contract (all portfolio items)

Each item in `output/portfolio.json.items[]` includes:

- `type`: `repo | idea`
- `category`: `product | tooling | library | learning | content | infra | experiment | template`
- `state`: `idea | active | stale | abandoned | archived | reference-only`
- `strategy`: `strategic-core | strategic-support | opportunistic | maintenance | parked`
- `effort`: `xs | s | m | l | xl`
- `value`: `low | medium | high | very-high`
- `nextAction`: `"<Verb> <target> — Done when: <measurable condition>"`
- `taxonomyMeta` with per-field source provenance (`default | user | inferred`)

`output/inventory.json.items[]` also includes taxonomy fields and `taxonomyMeta` for repos.

## Determinism Rules

- Snapshot date uses `--as-of` or UTC today (calculated once per run).
- `inventory.json.meta.asOfDate` persists snapshot date.
- `portfolio.json.meta.asOfDate` copies inventory `asOfDate` or `null` when inventory is missing.
- Item sorting is deterministic:
  - repos by `fullName` asc in inventory
  - ideas by `slug` asc in ideas output
  - portfolio by `score` desc, then `slug` asc
- Item-level generated timestamps are not stored.

## nextAction Validation

Required canonical format:

`"<Verb> <target> — Done when: <measurable condition>"`

Robust input acceptance:

- Accepts `" - Done when:"` from user input
- Normalizes output to em dash `"— Done when:"`
- Rejects invalid values with a clear error message

## Architecture Overview

Main modules:

- `bin/github-portfolio-analyzer.js`: executable entrypoint
- `src/cli.js`: command routing + option parsing
- `src/config.js`: env loading and token validation
- `src/github/*`: API client, pagination, structural inspection
- `src/core/*`: scoring, taxonomy, ideas ingestion, portfolio merge
- `src/io/*`: JSON/CSV/markdown/report writers
- `src/utils/*`: time, slug, retry, concurrency, nextAction handling

Design choices:

- Minimal dependencies (`dotenv` only)
- GitHub API only (no repository cloning)
- Retry/backoff for rate limits (403/429)
- Per-repo fault isolation during analysis
- Deterministic output ordering

## Testing

Run all tests:

```bash
npm test
```

The test suite validates:

- taxonomy presence and shape
- `nextAction` marker behavior (`— Done when:`)
- score/activity/maturity boundaries
- portfolio `asOfDate` null behavior when inventory is missing
- deterministic merge ordering

## Output Layout

```text
/output
  /projects
    {project-slug}.md
  inventory.json
  ideas.json
  portfolio.json
  inventory.csv
  portfolio-summary.md
  portfolio-report.json
  portfolio-report.md
  portfolio-report.txt
```
