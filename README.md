# Claude Daily Digest

毎朝のニュース・テック記事・メールを自動収集・要約し、Slack に配信するローカル cron + Claude Code ツール。

## Features

- **ニュース収集**: Yahoo!ニュース、NHK、時事通信、ITmedia、GIGAZINE 等の RSS フィードから主要ニュースを自動取得
- **テック記事**: Qiita / Zenn のトレンド記事を API で取得（ON/OFF 可能）
- **メール確認**: Gmail MCP 経由で受信メールを確認し、要対応メールを要約（ON/OFF 可能）
- **AI 要約**: Claude Code がニュースを選定・要約し、Slack に配信

## 仕組みの全体像

3つの cron ジョブで動作する。

```
05:00  ニュースタスク
06:00  メールタスク
18:00  メールタスク
```

### ニュースタスク（05:00）

3フェーズで処理される。

1. **データ取得**: `node src/fetch-news.js` で RSS/API からニュースを取得し、`data/news-data.json` に保存
2. **AI 選定・要約**: `claude -p tasks/news-task.md` で Claude Code がニュースを選定・要約し、`data/news-output.txt` に出力
3. **Slack 送信**: シェルスクリプトが `node src/slack-webhook.js` で Slack Webhook に送信

### メールタスク（06:00 / 18:00）

- Claude Code が Gmail MCP 経由でメールを確認し、要確認メールを `data/mail-output.txt` に出力。シェルスクリプトが Slack に送信
- こちらは一日２回実行される

## 前提条件

- Node.js 20 以上
- [Claude Code CLI](https://docs.anthropic.com/claude-code)（認証済み）
- Slack Incoming Webhook URL
- （メール機能を使う場合）Gmail MCP が Claude Code で利用可能

## セットアップ

### 1. クローン・インストール

```bash
git clone https://github.com/ookuwab/claude-daily-digest.git
cd claude-daily-digest
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して設定値を入力:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
SLACK_USER_ID=U0123456789
ENABLE_TECH_FEEDS=true
ENABLE_MAIL_DIGEST=true
```

### 3. Gmail 認証設定（メール機能を使う場合）

Claude Code の Gmail MCP を使用してメールにアクセスする。初回は Claude Code 実行時に OAuth 認証フローが起動する。

1. Gmail MCP が有効であることを確認（Claude Code の設定画面で確認）
2. 初回実行時にブラウザが開き、Gmail アカウントへのアクセス許可を求められる
3. 許可すると以降は自動で認証される

### 4. crontab 設定

```bash
crontab -e
```

`crontab.example` の内容をコピーし、パスを自分の環境に合わせて編集する。

> **cron の注意点**
> - PATH に `node` と `claude` のパスが必要。`crontab.example` の PATH 行を参照
> - `~` は使えない。必ず絶対パス（`/Users/...` や `/home/...`）で記述すること
> - 設定は永続的。一度登録すれば PC 再起動後も残る
> - ただし **PC がスリープ中・電源オフの時刻のジョブは実行されない**
> - 登録確認: `crontab -l`

## カスタマイズ

### RSS フィードの追加・変更

`src/config.js` の `RSS_FEEDS` 配列を編集する。

```js
{ url: 'https://example.com/rss.xml', source: 'Example', category: 'カテゴリ' },
```

### テック記事取得の ON/OFF

`.env` で `ENABLE_TECH_FEEDS=false` に設定すると、Qiita/Zenn のトレンド記事取得をスキップする。

### メール要約の ON/OFF

`.env` で `ENABLE_MAIL_DIGEST=false` に設定すると、メールタスクが即座に終了する。crontab に登録したままでも無効化できる。

## ファイル構成

```
src/
├── config.js          # 設定・フィード定義
├── format.js          # 日付フォーマットユーティリティ
├── articles.js        # 記事重複排除
├── rss-feed.js        # RSS/Atom フィード取得・パース
├── tech-feed.js       # Qiita/Zenn API 取得
├── slack-webhook.js   # Slack Webhook 送信・メッセージ分割
└── fetch-news.js      # メインオーケストレーション・CLI
scripts/
├── run-news.sh        # ニュース cron ラッパー
├── run-mail.sh        # メール cron ラッパー
└── format-session-log.sh  # Claude Code ログ整形
tasks/
├── news-task.md       # Claude Code 用ニュース選定プロンプト
└── mail-task.md       # Claude Code 用メール確認プロンプト
data/                  # ランタイム生成ファイル（gitignore 対象）
__tests__/             # Jest テスト
.env.example           # 環境変数テンプレート
crontab.example        # crontab 設定テンプレート
```

## 手動実行

```bash
# ニュース
./scripts/run-news.sh

# メール
./scripts/run-mail.sh

# テスト
npm test
```

## ライセンス

MIT
