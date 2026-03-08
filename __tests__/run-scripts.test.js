const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUN_NEWS_PATH = path.join(PROJECT_ROOT, 'scripts/run-news.sh');
const RUN_MAIL_PATH = path.join(PROJECT_ROOT, 'scripts/run-mail.sh');

describe('run-news.sh', () => {
  const content = fs.readFileSync(RUN_NEWS_PATH, 'utf-8');

  it('should define OUTPUT_FILE variable', () => {
    expect(content).toContain('OUTPUT_FILE="$PROJECT_DIR/data/news-output.txt"');
  });

  it('should clean up previous output file before Claude run', () => {
    const rmIndex = content.indexOf('rm -f "$OUTPUT_FILE"');
    const claudeIndex = content.indexOf('claude -p');
    expect(rmIndex).toBeGreaterThan(-1);
    expect(claudeIndex).toBeGreaterThan(-1);
    expect(rmIndex).toBeLessThan(claudeIndex);
  });

  it('should use Read,Write,WebSearch as allowedTools (no Bash)', () => {
    expect(content).toContain('--allowedTools "Read,Write,WebSearch"');
    expect(content).not.toContain('Bash(read files:*)');
  });

  it('should check output file existence after Claude run', () => {
    expect(content).toContain('[ ! -f "$OUTPUT_FILE" ]');
  });

  it('should send via slack-webhook.js with --file flag', () => {
    expect(content).toContain('node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE"');
  });

  it('should pipe claude output through tee for logging', () => {
    expect(content).toContain('2>&1 | tee -a "$LOG_FILE"');
  });

  it('should exit with error if output file is missing', () => {
    const checkIndex = content.indexOf('[ ! -f "$OUTPUT_FILE" ]');
    const exitIndex = content.indexOf('exit 1', checkIndex);
    expect(exitIndex).toBeGreaterThan(checkIndex);
  });
});

describe('run-mail.sh', () => {
  const content = fs.readFileSync(RUN_MAIL_PATH, 'utf-8');

  it('should define OUTPUT_FILE variable', () => {
    expect(content).toContain('OUTPUT_FILE="$PROJECT_DIR/data/mail-output.txt"');
  });

  it('should clean up previous output file before Claude run', () => {
    const rmIndex = content.indexOf('rm -f "$OUTPUT_FILE"');
    const claudeIndex = content.indexOf('claude -p');
    expect(rmIndex).toBeGreaterThan(-1);
    expect(claudeIndex).toBeGreaterThan(-1);
    expect(rmIndex).toBeLessThan(claudeIndex);
  });

  it('should use Gmail MCP tools, Read, Write, WebSearch as allowedTools (no Bash)', () => {
    expect(content).toContain('mcp__claude_ai_Gmail__gmail_search_messages');
    expect(content).toContain('Read,Write,WebSearch');
    expect(content).not.toContain('Bash(read files:*)');
  });

  it('should check output file existence as part of success condition', () => {
    expect(content).toContain('[ -f "$OUTPUT_FILE" ]');
  });

  it('should send via slack-webhook.js with --file flag', () => {
    expect(content).toContain('node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE"');
  });

  it('should pipe claude output through tee for logging', () => {
    expect(content).toContain('2>&1 | tee -a "$LOG_FILE"');
  });

  it('should update status with lastSuccessTime on success', () => {
    expect(content).toContain("lastSuccessTime");
    expect(content).toContain("Status updated: success");
  });

  it('should update status to failure when any step fails', () => {
    expect(content).toContain("Status updated: failure");
  });

  it('should send Slack notification on failure', () => {
    expect(content).toContain("Mail Briefing がエラー終了しました");
  });
});
