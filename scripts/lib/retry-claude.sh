#!/bin/bash
# timeout (exit code 124) 時に claude -p を自動リトライする共通関数

# retry_on_timeout <log_file> <max_retries> <run_function>
#   run_function: 呼び出し元で定義した関数名（claude -p パイプラインを実行する）
#   戻り値: 最後の実行の exit code
retry_on_timeout() {
  local log_file="$1"
  local max_retries="$2"
  local run_func="$3"

  local attempt=1
  local exit_code=0

  while [ "$attempt" -le "$max_retries" ]; do
    exit_code=0
    "$run_func" || exit_code=$?

    if [ "$exit_code" -ne 124 ]; then
      break
    fi

    echo "Claude timed out (attempt $attempt/$max_retries), retrying in 10s..." | tee -a "$log_file"
    attempt=$((attempt + 1))
    sleep 10
  done

  return "$exit_code"
}
