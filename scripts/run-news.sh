#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
DATA_FILE="$PROJECT_DIR/data/news-data.json"
TASK_FILE="$PROJECT_DIR/tasks/news-task.md"
OUTPUT_FILE="$PROJECT_DIR/data/news-output.txt"

# .env 読み込み
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).log"

# Webhook URL（チャンネル別）
WEBHOOK_URL="$SLACK_WEBHOOK_URL_NEWS"

# エラー時Slack通知
notify_error() {
  echo ":warning: News Briefing がエラー終了しました。ログ: $LOG_FILE" \
    | node "$PROJECT_DIR/src/slack-webhook.js" --webhook-url "$WEBHOOK_URL" --username "News Briefing" --icon-emoji ":warning:" 2>&1 | tee -a "$LOG_FILE" || true
}
trap notify_error ERR

# モデル設定（sonnet / opus → claude-{name}-4-6 に展開）
CLAUDE_MODEL_FLAG=""
case "${CLAUDE_MODEL:-}" in
  sonnet) CLAUDE_MODEL_FLAG="--model claude-sonnet-4-6" ;;
  opus)   CLAUDE_MODEL_FLAG="--model claude-opus-4-6" ;;
  "")     ;; # 未指定: Claude Code デフォルト
  *)      CLAUDE_MODEL_FLAG="--model $CLAUDE_MODEL" ;; # フルID指定も許容
esac

echo "=== News Task Start: $(date) ===" | tee "$LOG_FILE"
echo "Model: ${CLAUDE_MODEL:-default}" | tee -a "$LOG_FILE"

echo "--- Phase 1: RSS/API fetch ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/fetch-news.js" "$DATA_FILE" 2>&1 | tee -a "$LOG_FILE"

rm -f "$OUTPUT_FILE"

# タスクファイルのテンプレート変数を置換
TEMP_TASK=$(mktemp)
sed "s/{{SLACK_USER_ID}}/${SLACK_USER_ID:-UNKNOWN}/g" "$TASK_FILE" > "$TEMP_TASK"

JSONL_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).jsonl"

CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-1200}"  # デフォルト20分
CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"

source "$SCRIPT_DIR/lib/retry-claude.sh"

run_claude() {
  timeout --kill-after=30 "$CLAUDE_TIMEOUT" claude -p "$(cat "$TEMP_TASK")" \
    $CLAUDE_MODEL_FLAG \
    --allowedTools "Read,Write,WebSearch" \
    --output-format stream-json \
    --verbose \
    </dev/null 2>&1 \
    | tee "$JSONL_FILE" \
    | bash "$SCRIPT_DIR/format-session-log.sh" \
    | tee -a "$LOG_FILE"
}

echo "--- Phase 2: Claude Code news selection ---" | tee -a "$LOG_FILE"
claude_exit=0
retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude || claude_exit=$?

if [ "$claude_exit" -ne 0 ]; then
  notify_error
  exit "$claude_exit"
fi

rm -f "$TEMP_TASK"

if [ ! -f "$OUTPUT_FILE" ]; then
  echo "ERROR: Output file not created by Claude: $OUTPUT_FILE" | tee -a "$LOG_FILE"
  exit 1
fi

echo "--- Phase 3: Slack delivery ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE" --webhook-url "$WEBHOOK_URL" --username "News Briefing" --icon-emoji ":newspaper:" 2>&1 | tee -a "$LOG_FILE"

echo "=== News Task End: $(date) ===" | tee -a "$LOG_FILE"
