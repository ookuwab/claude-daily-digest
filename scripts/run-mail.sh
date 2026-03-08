#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
STATUS_FILE="$PROJECT_DIR/data/mail-status.json"
TASK_FILE="$PROJECT_DIR/tasks/mail-task.md"
OUTPUT_FILE="$PROJECT_DIR/data/mail-output.txt"

# .env 読み込み（.env.local 優先）
if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a; source "$PROJECT_DIR/.env.local"; set +a
elif [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

# ENABLE_MAIL_DIGEST が false なら即座に終了
if [ "${ENABLE_MAIL_DIGEST:-true}" = "false" ]; then
  echo "Mail digest is disabled (ENABLE_MAIL_DIGEST=false). Skipping."
  exit 0
fi

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/mail-$(date +%Y%m%d-%H%M%S).log"
TODAY=$(date +%Y-%m-%d)

echo "=== Mail Task Start: $(date) ===" | tee "$LOG_FILE"

# 前回成功時刻を取得（なければ26時間前）
DEFAULT_EPOCH=$(node -e "console.log(Math.floor(Date.now()/1000 - 26*3600))")
if [ -f "$STATUS_FILE" ]; then
  LAST_SUCCESS=$(node -e "const s=JSON.parse(require('fs').readFileSync('$STATUS_FILE','utf8'));console.log(s.lastSuccessTime!==undefined?s.lastSuccessTime:$DEFAULT_EPOCH)" 2>/dev/null || echo "$DEFAULT_EPOCH")
else
  LAST_SUCCESS="$DEFAULT_EPOCH"
fi

# 前回成功時刻 - 1時間
FETCH_FROM_EPOCH=$((LAST_SUCCESS - 3600))

echo "Fetch from epoch: $FETCH_FROM_EPOCH ($(date -r "$FETCH_FROM_EPOCH" 2>/dev/null || date -d "@$FETCH_FROM_EPOCH" 2>/dev/null || echo 'N/A'))" | tee -a "$LOG_FILE"

# タスクファイルのテンプレート変数を置換
TEMP_TASK=$(mktemp)
sed -e "s/{{FETCH_FROM_EPOCH}}/$FETCH_FROM_EPOCH/g" \
    -e "s/{{SLACK_USER_ID}}/${SLACK_USER_ID:-UNKNOWN}/g" \
    "$TASK_FILE" > "$TEMP_TASK"

rm -f "$OUTPUT_FILE"

JSONL_FILE="$LOG_DIR/mail-$(date +%Y%m%d-%H%M%S).jsonl"

echo "--- Claude Code mail check ---" | tee -a "$LOG_FILE"
if claude -p "$(cat "$TEMP_TASK")" \
  --allowedTools "mcp__claude_ai_Gmail__gmail_search_messages,mcp__claude_ai_Gmail__gmail_read_message,mcp__claude_ai_Gmail__gmail_read_thread,Read,Write,WebSearch" \
  --output-format stream-json \
  --verbose \
  </dev/null 2>&1 \
  | tee "$JSONL_FILE" \
  | bash "$SCRIPT_DIR/format-session-log.sh" \
  | tee -a "$LOG_FILE" \
  && [ -f "$OUTPUT_FILE" ] \
  && node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE" --username "Mail Briefing" --icon-emoji ":email:" 2>&1 | tee -a "$LOG_FILE"; then

  # 成功時ステータス更新
  CURRENT_EPOCH=$(date +%s)
  node -e "require('fs').writeFileSync('$STATUS_FILE',JSON.stringify({todayDate:'$TODAY',lastSuccessTime:$CURRENT_EPOCH},null,2))"
  echo "Status updated: success" | tee -a "$LOG_FILE"
else
  # 失敗時ステータス更新
  node -e "const fs=require('fs');let s={};try{s=JSON.parse(fs.readFileSync('$STATUS_FILE','utf8'))}catch(e){process.stderr.write(e.message+'\n')}s.todayDate='$TODAY';fs.writeFileSync('$STATUS_FILE',JSON.stringify(s,null,2))"
  echo "Status updated: failure" | tee -a "$LOG_FILE"
  # エラー時Slack通知
  echo ":warning: Mail Briefing がエラー終了しました。ログ: $LOG_FILE" \
    | node "$PROJECT_DIR/src/slack-webhook.js" --username "Mail Briefing" --icon-emoji ":warning:" 2>&1 | tee -a "$LOG_FILE" || true
fi

rm -f "$TEMP_TASK"

echo "=== Mail Task End: $(date) ===" | tee -a "$LOG_FILE"
