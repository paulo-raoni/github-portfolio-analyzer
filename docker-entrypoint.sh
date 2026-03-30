#!/bin/sh
set -e

OUTPUT_DIR="${OUTPUT_DIR:-/data/analyzer-output}"
REPORT_PATH="${REPORT_PATH:-/data/portfolio-report.json}"

mkdir -p "$OUTPUT_DIR"

echo "[analyzer] Running analyze..."
node bin/github-portfolio-analyzer.js analyze --output-dir "$OUTPUT_DIR"

echo "[analyzer] Running build-portfolio..."
node bin/github-portfolio-analyzer.js build-portfolio --output-dir "$OUTPUT_DIR"

echo "[analyzer] Running report..."
node bin/github-portfolio-analyzer.js report \
  --format json \
  --output-dir "$OUTPUT_DIR" \
  --output "$OUTPUT_DIR"

# Move o JSON para o path esperado pelo worker via volume compartilhado
cp "$OUTPUT_DIR/portfolio-report.json" "$REPORT_PATH"

echo "[analyzer] Done. Report written to $REPORT_PATH"
