#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
STATUS_FILE="$PROJECT_DIR/data/mail-status.json"
CODEX_TASK_FILE="$PROJECT_DIR/tasks/mail-task.md"
CLAUDE_TASK_FILE="$PROJECT_DIR/tasks/mail-task-claude.md"
OUTPUT_FILE="$PROJECT_DIR/data/mail-output.txt"

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

# ENABLE_MAIL_DIGEST が false なら即座に終了
if [ "${ENABLE_MAIL_DIGEST:-true}" = "false" ]; then
  echo "Mail digest is disabled (ENABLE_MAIL_DIGEST=false). Skipping."
  exit 0
fi

mkdir -p "$LOG_DIR"

# Webhook URL（チャンネル別）
WEBHOOK_URL="$SLACK_WEBHOOK_URL_MAIL"

LOG_FILE="$LOG_DIR/mail-$(date +%Y%m%d-%H%M%S).log"
TODAY=$(date +%Y-%m-%d)

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

echo "=== Mail Task Start: $(date) ===" | tee "$LOG_FILE"
echo "Provider: $AI_PROVIDER" | tee -a "$LOG_FILE"
if [ "$AI_PROVIDER" = "codex" ]; then
  echo "Model: ${CODEX_MODEL:-default}" | tee -a "$LOG_FILE"
else
  echo "Model: ${CLAUDE_MODEL:-default}" | tee -a "$LOG_FILE"
fi

if [ "$AI_PROVIDER" = "claude" ]; then
  # Claude側の従来実装: MCPコネクタ用OAuthトークンをメインタスク前に更新する。
  echo "--- OAuth warmup: $(date) ---" >> "$LOG_DIR/warmup.log"
  claude -p "Reply with OK" \
    --max-turns 1 \
    --output-format text \
    </dev/null >> "$LOG_DIR/warmup.log" 2>&1 \
    || echo "OAuth warmup failed (exit $?), continuing" >> "$LOG_DIR/warmup.log"
  sleep 3
fi

# 前回成功時刻を取得（なければ26時間前）
DEFAULT_EPOCH=$(node -e "console.log(Math.floor(Date.now()/1000 - 26*3600))")
if [ -f "$STATUS_FILE" ]; then
  LAST_SUCCESS=$(node -e "const s=JSON.parse(require('fs').readFileSync('$STATUS_FILE','utf8'));console.log(s.lastSuccessTime!==undefined?s.lastSuccessTime:$DEFAULT_EPOCH)" 2>/dev/null || echo "$DEFAULT_EPOCH")
else
  LAST_SUCCESS="$DEFAULT_EPOCH"
fi

# 前回成功時刻 - 1時間
FETCH_FROM_EPOCH=$((LAST_SUCCESS - 3600))

# 人間可読な取得開始日時
FETCH_FROM_DATE=$(date -r "$FETCH_FROM_EPOCH" "+%Y/%m/%d %H:%M" 2>/dev/null || date -d "@$FETCH_FROM_EPOCH" "+%Y/%m/%d %H:%M" 2>/dev/null || echo 'N/A')
echo "Fetch from epoch: $FETCH_FROM_EPOCH ($FETCH_FROM_DATE)" | tee -a "$LOG_FILE"

# タスクファイルのテンプレート変数を置換
TEMP_TASK=$(mktemp)
cleanup() {
  rm -f "$TEMP_TASK"
}
trap cleanup EXIT
sed -e "s|{{FETCH_FROM_EPOCH}}|$FETCH_FROM_EPOCH|g" \
    -e "s|{{FETCH_FROM_DATE}}|$FETCH_FROM_DATE|g" \
    -e "s|{{SLACK_USER_ID}}|${SLACK_USER_ID:-UNKNOWN}|g" \
    "$TASK_FILE" > "$TEMP_TASK"

rm -f "$OUTPUT_FILE"

JSONL_FILE="$LOG_DIR/mail-$(date +%Y%m%d-%H%M%S).jsonl"

CODEX_TIMEOUT="${CODEX_TIMEOUT:-1200}"  # デフォルト20分
CODEX_RETRY_MAX="${CODEX_RETRY_MAX:-3}"
CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-1200}"  # デフォルト20分
CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"

run_codex() {
  timeout --kill-after=30 "$CODEX_TIMEOUT" \
    codex \
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
    --allowedTools "mcp__claude_ai_Gmail__search_threads,mcp__claude_ai_Gmail__get_thread,Read,Write,Grep,WebSearch" \
    --disallowedTools "Bash,Edit" \
    --max-turns 50 \
    --output-format stream-json \
    --verbose \
    </dev/null 2>&1 \
    | tee "$JSONL_FILE" \
    | bash "$SCRIPT_DIR/format-session-log.sh" \
    | tee -a "$LOG_FILE"
}

ai_exit=0
if [ "$AI_PROVIDER" = "codex" ]; then
  echo "--- Codex mail check ---" | tee -a "$LOG_FILE"
  source "$SCRIPT_DIR/lib/retry-codex.sh"
  codex_exit=0
  retry_on_timeout "$LOG_FILE" "$CODEX_RETRY_MAX" run_codex || codex_exit=$?
  ai_exit="$codex_exit"
else
  echo "--- Claude Code mail check ---" | tee -a "$LOG_FILE"
  source "$SCRIPT_DIR/lib/retry-claude.sh"
  claude_exit=0
  retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude || claude_exit=$?
  ai_exit="$claude_exit"
fi

if [ "$ai_exit" -eq 0 ] \
  && [ -f "$OUTPUT_FILE" ] \
  && [ -s "$OUTPUT_FILE" ] \
  && node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE" --webhook-url "$WEBHOOK_URL" --username "Mail Briefing" --icon-emoji ":email:" 2>&1 | tee -a "$LOG_FILE"; then

  # 成功時ステータス更新
  CURRENT_EPOCH=$(date +%s)
  node -e "require('fs').writeFileSync('$STATUS_FILE',JSON.stringify({todayDate:'$TODAY',lastSuccessTime:$CURRENT_EPOCH},null,2))"
  echo "Status updated: success" | tee -a "$LOG_FILE"
else
  # lastSuccessTime は維持し、次回実行で失敗期間を再取得する
  node -e "const fs=require('fs');let s={};try{s=JSON.parse(fs.readFileSync('$STATUS_FILE','utf8'))}catch(e){process.stderr.write(e.message+'\\n')}s.todayDate='$TODAY';fs.writeFileSync('$STATUS_FILE',JSON.stringify(s,null,2))"
  echo "Status updated: failure" | tee -a "$LOG_FILE"
  echo ":warning: Mail Briefing がエラー終了しました。ログ: $LOG_FILE" \
    | node "$PROJECT_DIR/src/slack-webhook.js" --webhook-url "$WEBHOOK_URL" --username "Mail Briefing" --icon-emoji ":warning:" 2>&1 \
    | tee -a "$LOG_FILE" \
    || true
  exit 1
fi

echo "=== Mail Task End: $(date) ===" | tee -a "$LOG_FILE"
