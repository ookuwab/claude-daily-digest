const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUN_NEWS_PATH = path.join(PROJECT_ROOT, 'scripts/run-news.sh');
const RUN_MAIL_PATH = path.join(PROJECT_ROOT, 'scripts/run-mail.sh');
const RETRY_LIB_PATH = path.join(PROJECT_ROOT, 'scripts/lib/retry-claude.sh');

describe('lib/retry-claude.sh', () => {
  const content = fs.readFileSync(RETRY_LIB_PATH, 'utf-8');

  it('retry_on_timeout 関数が定義されていること', () => {
    expect(content).toContain('retry_on_timeout()');
  });

  it('リトライループが存在すること', () => {
    // Given: 共通ライブラリの内容
    // When: while ループの存在を検査
    // Then: リトライループの構造が確認できる
    expect(content).toMatch(/while\s/);
  });

  it('exit code 124 でリトライ判定すること', () => {
    // Given: 共通ライブラリの内容
    // When: exit code 124 の条件分岐を検査
    // Then: 124 によるリトライ判定が存在する
    expect(content).toContain('124');
    expect(content).toMatch(/exit_code.*124|124.*exit_code/);
  });

  it('リトライ間に 10 秒の待機があること', () => {
    // Given: 共通ライブラリの内容
    // When: sleep 10 の存在を検査
    // Then: リトライ待機が確認できる
    expect(content).toContain('sleep 10');
  });

  it('実行関数の exit code を捕捉すること', () => {
    // Given: 共通ライブラリの内容
    // When: || exit_code=$? パターンを検査
    // Then: exit code 捕捉パターンが存在する
    expect(content).toContain('|| exit_code=$?');
  });

  it('最後の exit code を return すること', () => {
    // Given: 共通ライブラリの内容
    // When: return 文を検査
    // Then: exit_code を返すことが確認できる
    expect(content).toContain('return "$exit_code"');
  });
});

describe('run-news.sh', () => {
  const content = fs.readFileSync(RUN_NEWS_PATH, 'utf-8');

  it('OUTPUT_FILE 変数が定義されていること', () => {
    expect(content).toContain('OUTPUT_FILE="$PROJECT_DIR/data/news-output.txt"');
  });

  it('Claude 実行前に前回の出力ファイルを削除すること', () => {
    const rmIndex = content.indexOf('rm -f "$OUTPUT_FILE"');
    const claudeIndex = content.indexOf('claude -p');
    expect(rmIndex).toBeGreaterThan(-1);
    expect(claudeIndex).toBeGreaterThan(-1);
    expect(rmIndex).toBeLessThan(claudeIndex);
  });

  it('allowedTools に Read,Write,WebSearch を指定し Bash を含まないこと', () => {
    expect(content).toContain('--allowedTools "Read,Write,WebSearch"');
    expect(content).not.toContain('Bash(read files:*)');
  });

  it('Claude 実行後に出力ファイルの存在を確認すること', () => {
    expect(content).toContain('[ ! -f "$OUTPUT_FILE" ]');
  });

  it('slack-webhook.js に --file フラグ付きで送信すること', () => {
    expect(content).toContain('node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE"');
  });

  it('Slack 送信に --webhook-url フラグを指定すること', () => {
    expect(content).toContain('--webhook-url "$WEBHOOK_URL"');
  });

  it('WEBHOOK_URL が SLACK_WEBHOOK_URL_NEWS から設定されていること', () => {
    expect(content).toContain('WEBHOOK_URL="$SLACK_WEBHOOK_URL_NEWS"');
  });

  it('Claude の出力を tee でログファイルに記録すること', () => {
    expect(content).toContain('2>&1 | tee -a "$LOG_FILE"');
  });

  it('出力ファイルが存在しない場合にエラー終了すること', () => {
    const checkIndex = content.indexOf('[ ! -f "$OUTPUT_FILE" ]');
    const exitIndex = content.indexOf('exit 1', checkIndex);
    expect(exitIndex).toBeGreaterThan(checkIndex);
  });

  describe('リトライ', () => {
    it('CLAUDE_RETRY_MAX のデフォルト値が 3 であること', () => {
      expect(content).toContain('CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"');
    });

    it('共通リトライ関数を読み込むこと', () => {
      // Given: スクリプト内容
      // When: source コマンドを検査
      // Then: 共通ライブラリの読み込みが確認できる
      expect(content).toContain('source "$SCRIPT_DIR/lib/retry-claude.sh"');
    });

    it('retry_on_timeout を呼び出すこと', () => {
      // Given: スクリプト内容
      // When: retry_on_timeout の呼び出しを検査
      // Then: 共通リトライ関数の呼び出しが確認できる
      expect(content).toContain('retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude');
    });

    it('claude -p の exit code を捕捉して set -e を回避すること', () => {
      // Given: スクリプト内容
      // When: || claude_exit=$? パターンを検査
      // Then: exit code 捕捉パターンが存在する
      expect(content).toContain('|| claude_exit=$?');
    });

    it('全リトライ失敗後に notify_error を呼び exit すること', () => {
      // Given: スクリプト内容
      // When: retry_on_timeout 後の notify_error と exit を検査
      // Then: notify_error が exit の前に呼ばれている
      const retryIndex = content.indexOf('retry_on_timeout');
      const afterRetry = content.substring(retryIndex);
      const notifyIndex = afterRetry.indexOf('notify_error');
      const exitIndex = afterRetry.indexOf('exit "$claude_exit"');
      expect(notifyIndex).toBeGreaterThan(-1);
      expect(exitIndex).toBeGreaterThan(-1);
      expect(notifyIndex).toBeLessThan(exitIndex);
    });

    it('run_claude 関数内に claude -p コマンドがあること', () => {
      // Given: スクリプト内容
      // When: run_claude 関数内の claude -p を検査
      // Then: run_claude 関数に claude -p パイプラインが含まれる
      const funcStart = content.indexOf('run_claude()');
      expect(funcStart).toBeGreaterThan(-1);
      const afterFunc = content.substring(funcStart);
      const funcEnd = afterFunc.indexOf('}');
      const funcBody = afterFunc.substring(0, funcEnd);
      expect(funcBody).toContain('timeout');
      expect(funcBody).toContain('claude -p');
    });
  });
});

describe('run-mail.sh', () => {
  const content = fs.readFileSync(RUN_MAIL_PATH, 'utf-8');

  it('OUTPUT_FILE 変数が定義されていること', () => {
    expect(content).toContain('OUTPUT_FILE="$PROJECT_DIR/data/mail-output.txt"');
  });

  it('Claude 実行前に前回の出力ファイルを削除すること', () => {
    const rmIndex = content.indexOf('rm -f "$OUTPUT_FILE"');
    const claudeIndex = content.indexOf('claude -p "$(cat "$TEMP_TASK")"');
    expect(rmIndex).toBeGreaterThan(-1);
    expect(claudeIndex).toBeGreaterThan(-1);
    expect(rmIndex).toBeLessThan(claudeIndex);
  });

  it('メインタスク前に OAuth warmup を実行すること', () => {
    const warmupIndex = content.indexOf('Reply with OK');
    const mainIndex = content.indexOf('claude -p "$(cat "$TEMP_TASK")"');
    expect(warmupIndex).toBeGreaterThan(-1);
    expect(mainIndex).toBeGreaterThan(-1);
    expect(warmupIndex).toBeLessThan(mainIndex);
  });

  it('OAuth warmup が失敗してもスクリプトが続行すること', () => {
    // warmup ブロック全体（複数行）で || による失敗吸収を確認
    const warmupStart = content.indexOf('Reply with OK');
    const warmupEnd = content.indexOf('sleep 3', warmupStart);
    expect(warmupStart).toBeGreaterThan(-1);
    expect(warmupEnd).toBeGreaterThan(-1);
    const warmupBlock = content.substring(warmupStart, warmupEnd);
    expect(warmupBlock).toMatch(/\|\|/);
  });

  it('allowedTools に Gmail MCP ツール・Read・Write・WebSearch を指定し Bash を含まないこと', () => {
    expect(content).toContain('mcp__claude_ai_Gmail__gmail_search_messages');
    expect(content).toContain('Read,Write,Grep,WebSearch');
    expect(content).not.toContain('Bash(read files:*)');
  });

  it('成功条件として出力ファイルの存在を確認すること', () => {
    expect(content).toContain('[ -f "$OUTPUT_FILE" ]');
  });

  it('slack-webhook.js に --file フラグ付きで送信すること', () => {
    expect(content).toContain('node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE"');
  });

  it('Slack 送信に --webhook-url フラグを指定すること', () => {
    expect(content).toContain('--webhook-url "$WEBHOOK_URL"');
  });

  it('WEBHOOK_URL が SLACK_WEBHOOK_URL_MAIL から設定されていること', () => {
    expect(content).toContain('WEBHOOK_URL="$SLACK_WEBHOOK_URL_MAIL"');
  });

  it('FETCH_FROM_DATE を算出してテンプレートに渡すこと', () => {
    expect(content).toContain('FETCH_FROM_DATE=');
    expect(content).toContain('{{FETCH_FROM_DATE}}');
  });

  it('Claude の出力を tee でログファイルに記録すること', () => {
    expect(content).toContain('2>&1 | tee -a "$LOG_FILE"');
  });

  it('成功時に lastSuccessTime でステータスを更新すること', () => {
    expect(content).toContain("lastSuccessTime");
    expect(content).toContain("Status updated: success");
  });

  it('失敗時にステータスを failure に更新すること', () => {
    expect(content).toContain("Status updated: failure");
  });

  it('失敗時に Slack エラー通知を送信すること', () => {
    expect(content).toContain("Mail Briefing がエラー終了しました");
  });

  describe('リトライ', () => {
    it('CLAUDE_RETRY_MAX のデフォルト値が 3 であること', () => {
      expect(content).toContain('CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"');
    });

    it('共通リトライ関数を読み込むこと', () => {
      // Given: スクリプト内容
      // When: source コマンドを検査
      // Then: 共通ライブラリの読み込みが確認できる
      expect(content).toContain('source "$SCRIPT_DIR/lib/retry-claude.sh"');
    });

    it('retry_on_timeout を呼び出すこと', () => {
      // Given: スクリプト内容
      // When: retry_on_timeout の呼び出しを検査
      // Then: 共通リトライ関数の呼び出しが確認できる
      expect(content).toContain('retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude');
    });

    it('claude -p の exit code を捕捉して set -e を回避すること', () => {
      // Given: スクリプト内容
      // When: || claude_exit=$? パターンを検査
      // Then: exit code 捕捉パターンが存在する
      expect(content).toContain('|| claude_exit=$?');
    });

    it('run_claude 関数内に claude -p コマンドがあること', () => {
      // Given: スクリプト内容
      // When: run_claude 関数内の claude -p を検査
      // Then: run_claude 関数に claude -p パイプラインが含まれる
      const funcStart = content.indexOf('run_claude()');
      expect(funcStart).toBeGreaterThan(-1);
      const afterFunc = content.substring(funcStart);
      const funcEnd = afterFunc.indexOf('}');
      const funcBody = afterFunc.substring(0, funcEnd);
      expect(funcBody).toContain('timeout');
      expect(funcBody).toContain('claude -p');
    });
  });
});
