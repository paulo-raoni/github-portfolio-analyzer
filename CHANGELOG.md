# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.4.2] - 2026-04-03

### Fixed
- `normalizeRepository` now explicitly coerces `private` to boolean, preventing `undefined` from propagating through the pipeline and causing private repos to be treated as public.
- `buildReportModel` always includes `private` in output (was omitted when falsy), ensuring the worker always receives an explicit value.

### Added
- Language breakdown via GitHub `/languages` API endpoint. Each repo now has a `languages` field (`Record<string, number>`) with byte counts per language, enabling multi-language badge display in the portfolio frontend.

## [1.4.1] - 2026-04-03

### Fixed
- `classifyFork`: removed `pushed_at` heuristic from fallback logic. Forks without a successful upstream comparison now always return `passive`. Previously, recently-cloned forks with no own commits were incorrectly classified as `active`.

## [1.4.0] — 2026-04-03

### Added
- Smoke tests for `--version` and `--help`
- Analyze command integration coverage for env-token execution and generated inventory fields
- `dormant` state in report summaries and documentation, while preserving manual `abandoned` compatibility

### Changed
- Automatic inactivity classification now returns `dormant` instead of `abandoned`
- Repository taxonomy inference now prioritizes `experiment` before `library`, broadens `learning` signals, and classifies simple apps like clocks/calculators/games as `product`
- Fork fallback classification now uses recent fork activity when upstream compare metadata is unavailable

## [1.3.0] — 2026-04-03

### Added
- `forkType` classification for forks via the GitHub compare API, distinguishing `active` forks from `passive` clones
- `publicAlias` best-effort generation for private repositories with OpenAI → Gemini → Anthropic fallback
- Global CLI credential flags: `--github-token`, `--github-username`, `--openai-key`, `--gemini-key`, `--anthropic-key`
- Interactive prompting for missing GitHub and optional LLM keys when `analyze` runs on a TTY
- Colored terminal output — progress, success, warning, and error states with ANSI colors
- Terminal header with ASCII art, version info, user, token status, and policy status
- Per-repository progress logging during `analyze` (Analyzing N/total: repo-name)
- Elapsed time in analyze completion summary
- Fallback count in analyze summary when structural inspection fails
- Fatal error messages for missing token, auth failure, and rate limit

## [1.2.0] — 2026-04-02

### Added
- `inferRepoCategory()` em `taxonomy.js`: inferência de categoria por heurística de nome, descrição e topics — detecta content, learning, template, library, infra, experiment, product; fallback: tooling
- `CATEGORY_WEIGHTS` em `scoring.js`: pesos de scoring distintos por categoria — `hasLicense` e `hasTests` zerados para content/learning/experiment, baselines altos para experiment (45), learning (35), template (30) e content (25)
- `category` exposto no output de `buildReportModel` em `report.js` — consumers do report (worker, frontend) agora recebem essa informação
- `docs/SCORING_MODEL.md`: documentação completa com tabela de pesos, exemplos end-to-end por categoria, e seção para agentes/LLMs
- Seção de scoring v2 no `AGENT_GUIDE.md`

### Changed
- `scoreRepository` agora lê `repository.category` para selecionar os pesos corretos; fallback para `tooling` se category ausente ou inválida
- `sources.category` em `buildRepoTaxonomy` retorna `'inferred'` em vez de `'default'`

## [1.0.0] — 2026-03-31

### Added
- Initial public release
- `analyze` command: fetch and score GitHub repositories into inventory outputs
- `ingest-ideas` command: normalize and score project ideas from JSON input
- `build-portfolio` command: merge repos and ideas into unified portfolio artifacts
- `report` command: generate decision-oriented reports (JSON, Markdown, ASCII)
- `--version` flag
- `--quiet`, `--strict`, `--explain`, `--format`, `--policy`, `--output-dir` flags
- JSON Schema for `portfolio-report.json` at `schemas/portfolio-report.schema.json`
- `analyzer.manifest.json` integration contract for external orchestrators
