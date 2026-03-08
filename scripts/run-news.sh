#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
DATA_FILE="$PROJECT_DIR/data/news-data.json"
TASK_FILE="$PROJECT_DIR/tasks/news-task.md"
OUTPUT_FILE="$PROJECT_DIR/data/news-output.txt"

# .env 読み込み（.env.local 優先）
if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a; source "$PROJECT_DIR/.env.local"; set +a
elif [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).log"

# エラー時Slack通知
notify_error() {
  echo ":warning: News Briefing がエラー終了しました。ログ: $LOG_FILE" \
    | node "$PROJECT_DIR/src/slack-webhook.js" --username "News Briefing" --icon-emoji ":warning:" 2>&1 | tee -a "$LOG_FILE" || true
}
trap notify_error ERR

echo "=== News Task Start: $(date) ===" | tee "$LOG_FILE"

echo "--- Phase 1: RSS/API fetch ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/fetch-news.js" "$DATA_FILE" 2>&1 | tee -a "$LOG_FILE"

rm -f "$OUTPUT_FILE"

# タスクファイルのテンプレート変数を置換
TEMP_TASK=$(mktemp)
sed "s/{{SLACK_USER_ID}}/${SLACK_USER_ID:-UNKNOWN}/g" "$TASK_FILE" > "$TEMP_TASK"

JSONL_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).jsonl"

echo "--- Phase 2: Claude Code news selection ---" | tee -a "$LOG_FILE"
claude -p "$(cat "$TEMP_TASK")" \
  --allowedTools "Read,Write,WebSearch" \
  --output-format stream-json \
  --verbose \
  </dev/null 2>&1 \
  | tee "$JSONL_FILE" \
  | bash "$SCRIPT_DIR/format-session-log.sh" \
  | tee -a "$LOG_FILE"

rm -f "$TEMP_TASK"

if [ ! -f "$OUTPUT_FILE" ]; then
  echo "ERROR: Output file not created by Claude: $OUTPUT_FILE" | tee -a "$LOG_FILE"
  exit 1
fi

echo "--- Phase 3: Slack delivery ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE" --username "News Briefing" --icon-emoji ":newspaper:" 2>&1 | tee -a "$LOG_FILE"

echo "=== News Task End: $(date) ===" | tee -a "$LOG_FILE"
