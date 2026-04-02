# Scoring Model

## Overview

A project score (0–100) reflects observable signals, not subjective quality.
High score != important project. It means: active, structured, and maintained
relative to its category.

## Score de Repositório — pesos por categoria

| Sinal | product | tooling | library | content | learning | infra | experiment | template |
|---|---|---|---|---|---|---|---|---|
| baseline | 0 | 0 | 0 | 25 | 35 | 0 | 45 | 30 |
| pushedWithin90Days | 25 | 25 | 20 | 25 | 20 | 25 | 20 | 10 |
| hasReadme | 15 | 15 | 20 | 15 | 15 | 20 | 15 | 25 |
| hasLicense | 10 | 10 | 20 | 0 | 0 | 10 | 0 | 10 |
| hasTests | 25 | 20 | 25 | 0 | 0 | 10 | 0 | 5 |
| starsOverOne | 5 | 5 | 10 | 5 | 5 | 5 | 5 | 10 |
| updatedWithin180Days | 20 | 25 | 5 | 30 | 25 | 30 | 15 | 10 |

`hasLicense` e `hasTests` são 0 para `content`, `learning` e `experiment`.

## Exemplos end-to-end por categoria

### content — repo de prompts

    Repo: "prompt-library" (category: content)
    baseline:              25
    pushedWithin90Days:   +25  (push há 10 dias)
    hasReadme:            +15
    hasLicense:            +0  (irrelevante para content)
    hasTests:              +0  (irrelevante para content)
    starsOverOne:          +0
    updatedWithin180Days: +30  (atualizado este mês)
    ─────────────────────────
    score:                 95

### library — pacote npm

    Repo: "my-utils" (category: library)
    baseline:               0
    pushedWithin90Days:   +20  (push há 45 dias)
    hasReadme:            +20
    hasLicense:           +20  (crítico para library)
    hasTests:             +25
    starsOverOne:         +10  (3 stars)
    updatedWithin180Days:  +0  (atualizado há 200 dias)
    ─────────────────────────
    score:                 95

### experiment — POC

    Repo: "poc-llm-routing" (category: experiment)
    baseline:              45
    pushedWithin90Days:    +0  (inativo há mais de 90 dias)
    hasReadme:            +15
    hasLicense:            +0
    hasTests:              +0
    starsOverOne:          +0
    updatedWithin180Days: +15
    ─────────────────────────
    score:                 75

## Score de Ideia

    baseline:            30
    scopeOrProblem:     +20  (scope ou problem preenchido)
    targetUser:         +15
    mvp:                +15
    nextAction:         +20
    ─────────────────────────
    max:                100

## Completion Level (CL0–CL5)

| CL | Label | Condição |
|---|---|---|
| 0 | Concept only | sem README, ou type=idea |
| 1 | Documented | tem README |
| 2 | Structured baseline | tem package.json (ou repo não-JS grande) |
| 3 | Automated workflow | tem CI |
| 4 | Tested workflow | tem tests |
| 5 | Production-ready candidate | CL4 + score >= 70 |

## Effort Estimate

| sizeKb | CL | estimate |
|---|---|---|
| < 100 | <= 2 | xs |
| < 500 | <= 3 | s |
| < 5000 | qualquer | m |
| < 20000 | qualquer | l |
| >= 20000 | qualquer | xl |

## Priority Band

    priorityScore = score
      + 10  (state=active)
      + 5   (state=stale)
      - 20  (state=abandoned/archived)
      + 10  (CL 1–3, quick-win zone)
      - 10  (effort=l ou xl)

    now:   priorityScore >= 80
    next:  65 <= priorityScore < 80
    later: 45 <= priorityScore < 65
    park:  priorityScore < 45

## Fluxo geral

    repo_metadata
      → inferRepoCategory()        → category
      → scoreRepository(category)  → score (0–100)
      → computeCompletionLevel()   → CL (0–5)
      → computeEffortEstimate()    → effort (xs/s/m/l/xl)
      → computePriorityBand()      → priorityScore → band (now/next/later/park)

## Para agentes e LLMs

Score alto (>70): projeto ativo, estruturado e mantido para sua categoria.
Score médio (40–70): funcional mas com gaps para o propósito declarado.
Score baixo (<40): inativo ou estruturalmente incompleto para seu propósito.

O score é relativo à categoria. Um `content` repo com score 85 e um `product`
repo com score 85 têm significados diferentes — o primeiro indica conteúdo
bem mantido, o segundo indica produto com testes, CI e atividade recente.

A `category` é inferida automaticamente por `inferRepoCategory()` em
`taxonomy.js` a partir de nome, descrição e topics do repo. Para ideias
(`type: 'idea'`), vem do campo `category` do `input.json` (curadoria manual).
