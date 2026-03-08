const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NEWS_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/news-task.md');
const MAIL_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/mail-task.md');

describe('news-task.md', () => {
  const content = fs.readFileSync(NEWS_TASK_PATH, 'utf-8');

  it('should not contain slack-webhook.js execution instructions', () => {
    expect(content).not.toContain('node src/slack-webhook.js');
  });

  it('should not contain Slack MCP usage instructions', () => {
    expect(content).not.toContain('Slack MCPは使用しない');
  });

  it('should instruct to write output to data/news-output.txt', () => {
    expect(content).toContain('data/news-output.txt');
    expect(content).toContain('Write');
  });

  it('should instruct Claude not to send to Slack', () => {
    expect(content).toContain('Claudeは送信を行わないこと');
  });

  it('should use Read tool instead of Bash cat for data reading', () => {
    expect(content).not.toContain('cat data/news-data.json');
    expect(content).toContain('`Read` ツールで `data/news-data.json` を読み取る');
  });

  it('should preserve the message template', () => {
    expect(content).toContain('Morning Briefing');
    expect(content).toContain('Tech Picks');
  });
});

describe('mail-task.md', () => {
  const content = fs.readFileSync(MAIL_TASK_PATH, 'utf-8');

  it('should not contain slack-webhook.js execution instructions', () => {
    expect(content).not.toContain('node src/slack-webhook.js');
  });

  it('should not contain Slack MCP usage instructions', () => {
    expect(content).not.toContain('Slack MCPは使用しない');
  });

  it('should instruct to write output to data/mail-output.txt', () => {
    expect(content).toContain('data/mail-output.txt');
    expect(content).toContain('Write');
  });

  it('should instruct Claude not to send to Slack', () => {
    expect(content).toContain('Claudeは送信を行わないこと');
  });

  it('should preserve the message template', () => {
    expect(content).toContain('Mail Briefing');
    expect(content).toContain('要確認メール');
  });
});
