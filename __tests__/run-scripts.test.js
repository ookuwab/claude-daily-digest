const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUN_NEWS_PATH = path.join(PROJECT_ROOT, 'scripts/run-news.sh');
const RUN_MAIL_PATH = path.join(PROJECT_ROOT, 'scripts/run-mail.sh');

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

  it('Claude の出力を tee でログファイルに記録すること', () => {
    expect(content).toContain('2>&1 | tee -a "$LOG_FILE"');
  });

  it('出力ファイルが存在しない場合にエラー終了すること', () => {
    const checkIndex = content.indexOf('[ ! -f "$OUTPUT_FILE" ]');
    const exitIndex = content.indexOf('exit 1', checkIndex);
    expect(exitIndex).toBeGreaterThan(checkIndex);
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
});
