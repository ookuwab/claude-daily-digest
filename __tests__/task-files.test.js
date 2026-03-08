const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NEWS_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/news-task.md');
const MAIL_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/mail-task.md');

describe('news-task.md', () => {
  const content = fs.readFileSync(NEWS_TASK_PATH, 'utf-8');

  it('slack-webhook.js の実行指示を含まないこと', () => {
    expect(content).not.toContain('node src/slack-webhook.js');
  });

  it('Slack MCP 使用指示を含まないこと', () => {
    expect(content).not.toContain('Slack MCPは使用しない');
  });

  it('出力先として data/news-output.txt への Write を指示すること', () => {
    expect(content).toContain('data/news-output.txt');
    expect(content).toContain('Write');
  });

  it('Claude が Slack 送信を行わない旨を指示すること', () => {
    expect(content).toContain('Claudeは送信を行わないこと');
  });

  it('データ読み取りに Read ツールを使用する旨を指示すること', () => {
    expect(content).not.toContain('cat data/news-data.json');
    expect(content).toContain('`Read` ツールで `data/news-data.json` を読み取る');
  });

  it('メッセージテンプレートが保持されていること', () => {
    expect(content).toContain('Morning Briefing');
    expect(content).toContain('Tech Picks');
  });
});

describe('mail-task.md', () => {
  const content = fs.readFileSync(MAIL_TASK_PATH, 'utf-8');

  it('slack-webhook.js の実行指示を含まないこと', () => {
    expect(content).not.toContain('node src/slack-webhook.js');
  });

  it('Slack MCP 使用指示を含まないこと', () => {
    expect(content).not.toContain('Slack MCPは使用しない');
  });

  it('出力先として data/mail-output.txt への Write を指示すること', () => {
    expect(content).toContain('data/mail-output.txt');
    expect(content).toContain('Write');
  });

  it('Claude が Slack 送信を行わない旨を指示すること', () => {
    expect(content).toContain('Claudeは送信を行わないこと');
  });

  it('メッセージテンプレートが保持されていること', () => {
    expect(content).toContain('Mail Briefing');
    expect(content).toContain('要確認メール');
  });
});
