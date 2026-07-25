const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NEWS_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/news-task.md');
const MAIL_TASK_PATH = path.join(PROJECT_ROOT, 'tasks/mail-task.md');
const CLAUDE_NEWS_TASK_PATH = path.join(
  PROJECT_ROOT,
  'tasks/news-task-claude.md',
);
const CLAUDE_MAIL_TASK_PATH = path.join(
  PROJECT_ROOT,
  'tasks/mail-task-claude.md',
);

describe.each([
  ['news-task.md', NEWS_TASK_PATH, 'Morning Briefing'],
  ['mail-task.md', MAIL_TASK_PATH, 'Mail Briefing'],
])('%s', (_name, taskPath, briefingTitle) => {
  const content = fs.readFileSync(taskPath, 'utf-8');

  it('Slack送信やローカルファイル書き込みをCodexへ依頼しないこと', () => {
    // Given: シェルが出力保存とSlack送信を担当するタスク
    // When: Codexへの指示を検査
    // Then: 最終回答本文の生成だけを依頼する
    expect(content).toContain('最終回答');
    expect(content).toContain('本文のみ');
    expect(content).not.toContain('data/news-output.txt');
    expect(content).not.toContain('data/mail-output.txt');
    expect(content).not.toContain('`Write`');
    expect(content).not.toContain('node src/slack-webhook.js');
  });

  it('CodexがSlackを直接送信しない旨を指示すること', () => {
    // Given: Slack送信はシェルスクリプトの責務
    // When: 禁止事項を検査
    // Then: Codexによる外部送信を防ぐ
    expect(content).toContain('Codexは送信を行わないこと');
  });

  it('Slack用のメッセージテンプレートを保持すること', () => {
    // Given: 既存のSlackダイジェスト形式
    // When: タスク本文を検査
    // Then: 各ブリーフィングの見出しを保持する
    expect(content).toContain(briefingTitle);
  });
});

describe('news-task.md', () => {
  const content = fs.readFileSync(NEWS_TASK_PATH, 'utf-8');

  it('ニュースデータを読み取り専用で参照すること', () => {
    // Given: 事前取得済みのニュースJSON
    // When: 入力手順を検査
    // Then: シェルを使わずローカルファイルを読む
    expect(content).not.toContain('cat data/news-data.json');
    expect(content).toContain('data/news-data.json');
    expect(content).toContain('読み取る');
  });

  it('主要ニュースとTech Picksを生成すること', () => {
    // Given: ニュースとテック記事を含む入力
    // When: 出力テンプレートを検査
    // Then: 両セクションを生成する
    expect(content).toContain('本日の主要ニュース');
    expect(content).toContain('Tech Picks');
  });
});

describe('mail-task.md', () => {
  const content = fs.readFileSync(MAIL_TASK_PATH, 'utf-8');

  it('Gmail検索を全ページ確認して必要な本文だけ取得すること', () => {
    // Given: 前回成功以降に多数のメールがある可能性
    // When: Gmailの検索・本文取得手順を検査
    // Then: search_emailsをページングして候補本文を一括取得する
    expect(content).toContain('search_emails');
    expect(content).toContain('next_page_token');
    expect(content).toContain('batch_read_email');
    expect(content).toContain('read_email_thread');
  });

  it('Gmailに対する変更操作を行わないこと', () => {
    // Given: 日次ダイジェストはメールボックス監査のみを行う
    // When: Gmail操作の制約を検査
    // Then: 送信・削除・アーカイブ・ラベル変更を禁止する
    expect(content).toContain('送信・削除・アーカイブ・ラベル変更');
    expect(content).toContain('一切行わない');
  });

  it('要確認メールと全件確認数を報告すること', () => {
    // Given: 重要メールと除外メールが混在する受信期間
    // When: 出力要件を検査
    // Then: 要確認事項と監査範囲の両方を明示する
    expect(content).toContain('要確認メール');
    expect(content).toContain('全件確認済み');
  });
});

describe.each([
  [
    'news-task-claude.md',
    CLAUDE_NEWS_TASK_PATH,
    'data/news-output.txt',
  ],
  [
    'mail-task-claude.md',
    CLAUDE_MAIL_TASK_PATH,
    'data/mail-output.txt',
  ],
])('%s', (_name, taskPath, outputPath) => {
  const content = fs.readFileSync(taskPath, 'utf-8');

  it('従来どおりWriteツールで出力ファイルを作成すること', () => {
    // Given: 旧Claude CLI用の専用タスク
    // When: 出力方法を検査
    // Then: ClaudeがSlack送信せず所定ファイルへ本文を書き出す
    expect(content).toContain('`Write`');
    expect(content).toContain(outputPath);
    expect(content).toContain('Claudeは送信を行わないこと');
  });
});

describe('mail-task-claude.md', () => {
  const content = fs.readFileSync(CLAUDE_MAIL_TASK_PATH, 'utf-8');

  it('従来のClaude Gmailコネクタを使用すること', () => {
    // Given: Claude側に接続していたGmail MCP
    // When: メール検索と本文取得の指示を検査
    // Then: search_threadsとget_threadで取得する
    expect(content).toContain('search_threads');
    expect(content).toContain('pageToken');
    expect(content).toContain('get_thread');
  });
});
