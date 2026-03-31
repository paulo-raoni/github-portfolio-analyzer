# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Colored terminal output — progress, success, warning, and error states with ANSI colors
- Terminal header with ASCII art, version info, user, token status, and policy status
- Per-repository progress logging during `analyze` (Analyzing N/total: repo-name)
- Elapsed time in analyze completion summary
- Fallback count in analyze summary when structural inspection fails
- Fatal error messages for missing token, auth failure, and rate limit

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
