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

## Scoring v2 — category-aware weights

A partir da v1.1.0, o score de repositórios é calculado com pesos diferentes por categoria.

**Categorias disponíveis:**
`product | tooling | library | content | learning | infra | experiment | template`

A categoria é inferida automaticamente por `inferRepoCategory()` em `taxonomy.js` a partir de nome, descrição e topics do repo. Para ideias, vem do campo `category` do input.

**Impacto na interpretação:**
- Um `content` repo sem license e sem tests não está errado — license/tests têm peso 0 para essa categoria
- Um `experiment` tem baseline=45, então mesmo sem atividade recente não vai para `park` automaticamente
- Um `library` sem license é genuinamente problemático — peso 20, o mais alto entre as categorias

Ver `docs/SCORING_MODEL.md` para tabela completa de pesos e exemplos numéricos.
