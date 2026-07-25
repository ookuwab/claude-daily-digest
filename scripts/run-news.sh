#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
DATA_FILE="$PROJECT_DIR/data/news-data.json"
CODEX_TASK_FILE="$PROJECT_DIR/tasks/news-task.md"
CLAUDE_TASK_FILE="$PROJECT_DIR/tasks/news-task-claude.md"
OUTPUT_FILE="$PROJECT_DIR/data/news-output.txt"

# .env 読み込み
AI_PROVIDER_OVERRIDE="${AI_PROVIDER-}"
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi
if [ -n "$AI_PROVIDER_OVERRIDE" ]; then
  AI_PROVIDER="$AI_PROVIDER_OVERRIDE"
fi

AI_PROVIDER="${AI_PROVIDER:-codex}"
case "$AI_PROVIDER" in
  codex) TASK_FILE="$CODEX_TASK_FILE" ;;
  claude) TASK_FILE="$CLAUDE_TASK_FILE" ;;
  *)
    echo "Unsupported AI_PROVIDER: $AI_PROVIDER (expected: codex or claude)" >&2
    exit 2
    ;;
esac

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).log"

# Webhook URL（チャンネル別）
WEBHOOK_URL="$SLACK_WEBHOOK_URL_NEWS"

# エラー時Slack通知
notify_error() {
  echo ":warning: News Briefing がエラー終了しました。ログ: $LOG_FILE" \
    | node "$PROJECT_DIR/src/slack-webhook.js" --webhook-url "$WEBHOOK_URL" --username "News Briefing" --icon-emoji ":warning:" 2>&1 \
    | tee -a "$LOG_FILE" \
    || true
}
trap notify_error ERR

CODEX_MODEL_ARGS=()
if [ -n "${CODEX_MODEL:-}" ]; then
  CODEX_MODEL_ARGS=(-m "$CODEX_MODEL")
fi

CLAUDE_MODEL_ARGS=()
case "${CLAUDE_MODEL:-}" in
  sonnet) CLAUDE_MODEL_ARGS=(--model claude-sonnet-4-6) ;;
  opus) CLAUDE_MODEL_ARGS=(--model claude-opus-4-6) ;;
  "") ;;
  *) CLAUDE_MODEL_ARGS=(--model "$CLAUDE_MODEL") ;;
esac

echo "=== News Task Start: $(date) ===" | tee "$LOG_FILE"
echo "Provider: $AI_PROVIDER" | tee -a "$LOG_FILE"
if [ "$AI_PROVIDER" = "codex" ]; then
  echo "Model: ${CODEX_MODEL:-default}" | tee -a "$LOG_FILE"
else
  echo "Model: ${CLAUDE_MODEL:-default}" | tee -a "$LOG_FILE"
fi

echo "--- Phase 1: RSS/API fetch ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/fetch-news.js" "$DATA_FILE" 2>&1 | tee -a "$LOG_FILE"

rm -f "$OUTPUT_FILE"

# タスクファイルのテンプレート変数を置換
TEMP_TASK=$(mktemp)
cleanup() {
  rm -f "$TEMP_TASK"
}
trap cleanup EXIT
sed "s/{{SLACK_USER_ID}}/${SLACK_USER_ID:-UNKNOWN}/g" "$TASK_FILE" > "$TEMP_TASK"

JSONL_FILE="$LOG_DIR/news-$(date +%Y%m%d-%H%M%S).jsonl"

CODEX_TIMEOUT="${CODEX_TIMEOUT:-1200}"  # デフォルト20分
CODEX_RETRY_MAX="${CODEX_RETRY_MAX:-3}"
CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-1200}"  # デフォルト20分
CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"

run_codex() {
  timeout --kill-after=30 "$CODEX_TIMEOUT" \
    codex \
      --search \
      --ask-for-approval never \
      exec \
      --ephemeral \
      --sandbox read-only \
      ${CODEX_MODEL_ARGS[@]+"${CODEX_MODEL_ARGS[@]}"} \
      --json \
      --output-last-message "$OUTPUT_FILE" \
      - \
      < "$TEMP_TASK" \
      2>>"$LOG_FILE" \
    | tee "$JSONL_FILE" \
    | bash "$SCRIPT_DIR/format-codex-log.sh" \
    | tee -a "$LOG_FILE"
}

run_claude() {
  timeout --kill-after=30 "$CLAUDE_TIMEOUT" claude -p "$(cat "$TEMP_TASK")" \
    ${CLAUDE_MODEL_ARGS[@]+"${CLAUDE_MODEL_ARGS[@]}"} \
    --allowedTools "Read,Write,WebSearch" \
    --output-format stream-json \
    --verbose \
    </dev/null 2>&1 \
    | tee "$JSONL_FILE" \
    | bash "$SCRIPT_DIR/format-session-log.sh" \
    | tee -a "$LOG_FILE"
}

ai_exit=0
if [ "$AI_PROVIDER" = "codex" ]; then
  echo "--- Phase 2: Codex news selection ---" | tee -a "$LOG_FILE"
  source "$SCRIPT_DIR/lib/retry-codex.sh"
  codex_exit=0
  retry_on_timeout "$LOG_FILE" "$CODEX_RETRY_MAX" run_codex || codex_exit=$?
  ai_exit="$codex_exit"
else
  echo "--- Phase 2: Claude Code news selection ---" | tee -a "$LOG_FILE"
  source "$SCRIPT_DIR/lib/retry-claude.sh"
  claude_exit=0
  retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude || claude_exit=$?
  ai_exit="$claude_exit"
fi

if [ "$ai_exit" -ne 0 ]; then
  notify_error
  exit "$ai_exit"
fi

if [ ! -f "$OUTPUT_FILE" ] || [ ! -s "$OUTPUT_FILE" ]; then
  echo "ERROR: Output file not created by $AI_PROVIDER: $OUTPUT_FILE" | tee -a "$LOG_FILE"
  exit 1
fi

echo "--- Phase 3: Slack delivery ---" | tee -a "$LOG_FILE"
node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE" --webhook-url "$WEBHOOK_URL" --username "News Briefing" --icon-emoji ":newspaper:" 2>&1 | tee -a "$LOG_FILE"

echo "=== News Task End: $(date) ===" | tee -a "$LOG_FILE"
