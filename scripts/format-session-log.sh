#!/usr/bin/env bash
# =============================================================================
# format-session-log.sh
#
# Claude Code の stream-json 出力を人間が読みやすい形式に変換する。
# Usage:
#   1. パイプフィルタ: claude -p --output-format stream-json | bash format-session-log.sh
#   2. ファイル指定:   bash format-session-log.sh session.jsonl
# =============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

if ! command -v jq &>/dev/null; then
  echo -e "${YELLOW}!!! jq が見つかりません。生の JSON を表示します。${NC}" >&2
  if [[ $# -gt 0 && -f "$1" ]]; then
    cat "$1"
  else
    cat
  fi
  exit 0
fi

format_stream() {
  jq --unbuffered -r '
    if .type == "assistant" then
      .message.content[]
      | if .type == "text" then
          .text
        elif .type == "thinking" then
          "\n\u001b[2m>>> [Thinking]\u001b[0m"
          + "\n\u001b[2m" + (.thinking | split("\n") | map("  " + .) | join("\n")) + "\u001b[0m"
        elif .type == "tool_use" then
          "\n\u001b[36m>>> [Tool: \(.name)]\u001b[0m"
          + if .name == "Read" then
              " \u001b[2m" + (.input.file_path // "") + "\u001b[0m"
            elif .name == "Edit" then
              " \u001b[2m" + (.input.file_path // "") + "\u001b[0m"
            elif .name == "Write" then
              " \u001b[2m" + (.input.file_path // "") + "\u001b[0m"
            elif .name == "Glob" then
              " \u001b[2m" + (.input.pattern // "") + "\u001b[0m"
            elif .name == "Grep" then
              " \u001b[2m" + (.input.pattern // "") + "\u001b[0m"
            elif .name == "Bash" then
              " \u001b[2m" + (.input.command // "" | split("\n")[0]) + "\u001b[0m"
            elif .name == "WebSearch" then
              " \u001b[2m" + (.input.query // "") + "\u001b[0m"
            else
              ""
            end
        else
          empty
        end
    elif .type == "result" then
      "\n\u001b[32m>>> [Session complete] cost: " + (.cost_usd // 0 | tostring) + " USD, duration: " + (.duration_ms // 0 | . / 1000 | tostring) + "s\u001b[0m"
    else
      empty
    end
  ' 2>/dev/null || true
}

if [[ $# -gt 0 && -f "$1" ]]; then
  format_stream < "$1"
else
  format_stream
fi
