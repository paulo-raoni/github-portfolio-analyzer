# AGENT_GUIDE

## Purpose

`github-portfolio-analyzer` is a deterministic CLI for portfolio intelligence. It analyzes GitHub repositories, ingests project ideas, builds a merged portfolio, and generates decision reports.

## Recommended CLI Workflow

```bash
github-portfolio-analyzer analyze
github-portfolio-analyzer ingest-ideas
github-portfolio-analyzer build-portfolio
github-portfolio-analyzer report --format json --quiet
```

## Input Expectations

- `analyze` requires `.env` with `GITHUB_TOKEN` (and typically `GITHUB_USERNAME`).
- `ingest-ideas` reads `ideas/input.json` by default, or a custom file via `--input`.
- `report` requires `output/portfolio.json`.
- Optional policy overlay: `priorities/policy.json` (copy from `priorities/policy.example.json`).

## Artifact Locations

Default output root: `output/`

- `output/inventory.json`
- `output/ideas.json`
- `output/portfolio.json`
- `output/portfolio-report.json`
- `output/portfolio-report.md`
- `output/portfolio-report.txt`

For report-only redirection:

```bash
github-portfolio-analyzer report --output ./runs/run-001
```

## Machine Usage Notes

- Prefer `report --format json --quiet` for programmatic consumption.
- Use `--strict` to fail unknown flags with exit code `2`.
- Exit codes:
  - `0` success
  - `1` operational failure
  - `2` invalid usage
