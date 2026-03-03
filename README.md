# github-portfolio-analyzer

Build a decision-ready developer portfolio from real GitHub repositories and planned ideas in one deterministic CLI workflow.
This project turns raw repository metadata into actionable prioritization outputs for execution planning.

---
**Tagline:** From repository inventory to execution decisions in minutes.

## Why This Tool Exists

Most portfolios are incomplete: repositories are analyzed, but pending ideas live in notes and never enter prioritization.
`github-portfolio-analyzer` unifies both streams and emits stable artifacts for reporting, planning, and backlog strategy.

## 3-Minute Quickstart

### 1) Requirements

- Node.js `22+`
- GitHub Personal Access Token (PAT) for `analyze`

### 2) Create a GitHub PAT (short version)

Create a token in GitHub settings and store it in `.env`.
Use the minimum read permissions needed to list repos and inspect repository files/workflows:

- **Fine-grained token:** repository `Metadata: Read`, `Contents: Read`, `Actions: Read`
- **Classic token (fallback):** `repo` scope (read usage by this CLI)

### 3) Install and configure

```bash
npm install
cp .env.example .env
```

Set values in `.env`:

```dotenv
GITHUB_TOKEN=your_github_token_here
GITHUB_USERNAME=your_github_username_here
```

### 4) Run the core pipeline

```bash
github-portfolio-analyzer analyze --as-of 2026-03-03
github-portfolio-analyzer ingest-ideas
github-portfolio-analyzer build-portfolio
github-portfolio-analyzer report --format all
```

Example console snippet:

```bash
$ github-portfolio-analyzer analyze --as-of 2026-03-03
Analyzed 51 repositories for octocat.
Wrote output/inventory.json.
Wrote output/inventory.csv.
```

## End-to-End Tutorial

### Step 1: Analyze repositories

```bash
github-portfolio-analyzer analyze --as-of 2026-03-03
```

What happens:

- Authenticates with GitHub API
- Fetches all repos with pagination
- Computes structural health, activity, maturity, score, taxonomy
- Writes `inventory.json` and `inventory.csv`

### Step 2: Ingest ideas

Default file mode:

```bash
github-portfolio-analyzer ingest-ideas
```

Interactive mode:

```bash
github-portfolio-analyzer ingest-ideas --prompt
```

What happens:

- Normalizes idea records
- Scores ideas
- Applies taxonomy defaults/inference with provenance metadata
- Normalizes `nextAction` to canonical format

### Step 3: Build merged portfolio

```bash
github-portfolio-analyzer build-portfolio
```

What happens:

- Merges repos + ideas
- Preserves deterministic ordering
- Writes `portfolio.json`, per-project markdown pages, and `portfolio-summary.md`

### Step 4: Generate decision report

```bash
github-portfolio-analyzer report --format all
```

What happens:

- Reads `portfolio.json` (required)
- Optionally reads `inventory.json` for richer repo completion signals
- Computes completion level, effort estimate, and priority band
- Writes ASCII + Markdown + JSON report artifacts

## Command Reference

| Command | Purpose | Key Options |
|---|---|---|
| `analyze` | Build repository inventory from GitHub API | `--as-of YYYY-MM-DD`, `--output-dir PATH` |
| `ingest-ideas` | Add/update idea records | `--input PATH`, `--prompt`, `--output-dir PATH` |
| `build-portfolio` | Merge repos + ideas into portfolio outputs | `--output-dir PATH` |
| `report` | Produce decision-oriented report artifacts | `--output-dir PATH`, `--format ascii\|md\|json\|all` |

Default for `report --format` is `all`.

## Output Directory Map

```text
/output
  /projects
    {project-slug}.md
  inventory.json
  inventory.csv
  ideas.json
  portfolio.json
  portfolio-summary.md
  portfolio-report.json
  portfolio-report.md
  portfolio-report.txt
```

Artifact roles:

- `inventory.json`: repository-only enriched source (includes taxonomy + taxonomyMeta)
- `ideas.json`: ideas-only normalized source
- `portfolio.json`: merged source of truth
- `portfolio-summary.md`: high-level portfolio summary (state sections + top 10)
- `portfolio-report.*`: decision-oriented planning report in machine and human formats

## Data Contracts

### Taxonomy contract (all portfolio items)

Each `portfolio.json.items[]` entry includes:

- `type`: `repo | idea`
- `category`: `product | tooling | library | learning | content | infra | experiment | template`
- `state`: `idea | active | stale | abandoned | archived | reference-only`
- `strategy`: `strategic-core | strategic-support | opportunistic | maintenance | parked`
- `effort`: `xs | s | m | l | xl`
- `value`: `low | medium | high | very-high`
- `nextAction`: `"<Verb> <target> — Done when: <measurable condition>"`
- `taxonomyMeta`: per-field provenance (`default | user | inferred`)

`inventory.json.items[]` includes the same taxonomy fields and `taxonomyMeta` for repositories.

### Report contract

`portfolio-report.json` includes:

- `meta` (generatedAt, asOfDate, owner, counts)
- `summary` (state counts, top10 by score, now/next/later/park)
- `matrix.completionByEffort` (`CL0..CL5` by `xs..xl`)
- `items[]` with decision fields (`completionLevel`, `effortEstimate`, `priorityBand`, `priorityWhy`)

## Decision Model (Report)

### Completion Level

- `CL0`: no README
- `CL1`: has README
- `CL2`: has package.json, or non-JS repo with size >= 500 KB
- `CL3`: CL2 + CI
- `CL4`: CL3 + tests
- `CL5`: CL4 + score >= 70
- Ideas default to `CL0`

### Effort Estimate

Uses taxonomy `effort` unless `effort` source is `default`.
If defaulted, infer by size and completion:

- `xs`: size < 100 KB and CL <= 2
- `s`: size < 500 KB and CL <= 3
- `m`: size < 5000 KB
- `l`: size < 20000 KB
- `xl`: size >= 20000 KB

`effortEstimate` is a report field only; it does not overwrite taxonomy `effort`.

### Priority Band

Internal score calculation:

- base: `score`
- `+10` if state `active`
- `+5` if state `stale`
- `-20` if state `abandoned` or `archived`
- `+10` if completion is CL1..CL3
- `-10` if effortEstimate is `l` or `xl`

Band mapping:

- `now`: >= 80
- `next`: 65..79
- `later`: 45..64
- `park`: < 45

## Determinism and Time Rules

- `asOfDate` is UTC-based (`--as-of` or UTC today once per `analyze` run)
- `inventory.json.meta.asOfDate` persists snapshot date
- `portfolio.json.meta.asOfDate` copies inventory asOfDate, or `null` when inventory is missing
- Item-level timestamps are not persisted
- Deterministic ordering:
  - inventory repos by `fullName` ascending
  - ideas by `slug` ascending
  - portfolio by `score` descending then `slug` ascending

## nextAction Validation

Required canonical format:

`"<Verb> <target> — Done when: <measurable condition>"`

Robust input support:

- Accepts fallback marker `" - Done when:"`
- Normalizes to em dash marker `"— Done when:"`
- Throws clear error for invalid format

## Architecture

```text
bin/
  github-portfolio-analyzer.js
src/
  commands/ (analyze, ingest-ideas, build-portfolio, report)
  core/     (classification, scoring, taxonomy, ideas, portfolio, report)
  github/   (api client, pagination, structural inspection)
  io/       (json/csv/markdown/report writers)
  utils/    (args, time, slug, retry, concurrency, nextAction)
```

Implementation characteristics:

- Minimal dependencies (`dotenv` only)
- Built-in `fetch`
- GitHub API only (no repository cloning)
- Retry/backoff on 403/429 and transient failures
- Per-repo error isolation during analysis

## Testing and Quality

Run the full suite:

```bash
npm test
```

Coverage includes:

- activity/maturity/scoring boundaries
- taxonomy presence and provenance behavior
- `nextAction` validation and normalization
- portfolio merge determinism
- report completion logic, priority mapping, and deterministic model generation

## Troubleshooting

### Missing `GITHUB_TOKEN`

`analyze` fails fast with a clear error when token is missing.
`ingest-ideas`, `build-portfolio`, and `report` still run without GitHub authentication.

### Missing `portfolio.json` for report

`report` requires `output/portfolio.json` and will fail with:

- `Missing required input: output/portfolio.json. Run build-portfolio before report.`

### Report with no inventory

If `inventory.json` is absent:

- report still runs from `portfolio.json`
- owner is `null`
- completion signals are best-effort from portfolio fields

## License and Contribution

Use this repository as a base for portfolio automation workflows and adapt heuristics for your organization.
Contributions should preserve deterministic contracts and avoid adding non-essential dependencies.
