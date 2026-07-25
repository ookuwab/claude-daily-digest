#!/usr/bin/env bash
# codex exec --json のJSONLイベントを人間が読みやすい形式へ変換する。

set -euo pipefail

if ! command -v jq &>/dev/null; then
  echo "!!! jq が見つかりません。生の JSON を表示します。" >&2
  if [[ $# -gt 0 && -f "$1" ]]; then
    cat "$1"
  else
    cat
  fi
  exit 0
fi

format_stream() {
  jq --unbuffered -r '
    if .type == "item.completed" then
      if .item.type == "agent_message" then
        .item.text
      elif .item.type == "mcp_tool_call" then
        "\n>>> [MCP: \(.item.server // "unknown")/\(.item.tool // "unknown")] \(.item.status // "")"
      elif .item.type == "web_search" then
        "\n>>> [Web search] \(.item.query // "")"
      elif .item.type == "command_execution" then
        "\n>>> [Command] \(.item.command // "") [\(.item.status // "")]"
      elif .item.type == "file_change" then
        "\n>>> [File change] \(.item.status // "")"
      else
        empty
      end
    elif .type == "turn.completed" then
      "\n>>> [Turn complete] input: \(.usage.input_tokens // 0), output: \(.usage.output_tokens // 0)"
    elif .type == "turn.failed" then
      "\n>>> [Turn failed] \(.error.message // .error // "unknown error")"
    elif .type == "error" then
      "\n>>> [Error] \(.message // .error.message // .error // "unknown error")"
    else
      empty
    end
  '
}

if [[ $# -gt 0 && -f "$1" ]]; then
  format_stream < "$1"
else
  format_stream
fi
