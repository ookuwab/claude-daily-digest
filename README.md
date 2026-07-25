# AI Daily Digest

毎朝のニュース・テック記事・メールを自動収集・要約し、Slack に配信するローカルツール。AI実行環境は環境変数で Codex（既定）または Claude Code を選択できる。macOS launchd Agent（推奨）または crontab でスケジュール実行する。

## Slack 出力イメージ

毎朝、以下のようなダイジェストが Slack に届きます。ニュースは選択したAIが選定・要約するため、タイトルだけでなく記事の中身まで把握できます。

### ニュース配信（毎朝 5:00）

```
@you
🌅 Morning Briefing - 2026/03/08（日）

━━━━━━━━━━━━━━━━━━━━
📰 本日の主要ニュース（15件）
━━━━━━━━━━━━━━━━━━━━

1. 🏛️ 2026年度予算案が衆院通過、過去最大の115兆円規模
   > 衆議院本会議で2026年度予算案が賛成多数で可決された。
   > 一般会計総額は過去最大の115兆円で、防衛費と社会保障費の
   > 増加が主な要因。野党は歳出削減が不十分と批判している。
   > NHK / 時事通信

2. 🌐 米中首脳がオンライン会談、半導体規制の緩和を協議
   > バイデン大統領と習近平国家主席がオンライン形式で会談し、
   > 半導体輸出規制の部分的な緩和について意見を交わした。
   > 共同声明では気候変動分野での協力再開にも合意した。
   > Yahoo!ニュース / NHK

3. 💰 日銀、追加利上げを見送り ー 円相場は一時149円台に
   > ...

...（計15件）

━━━━━━━━━━━━━━━━━━━━
💡 Tech Picks（Qiita / Zenn）
━━━━━━━━━━━━━━━━━━━━

1. Rust製CLIツールの作り方 ー 設計から配布まで（Zenn / ❤️ 245）
   > Rustでのコマンドラインツール開発を体系的に解説。clap、
   > anyhow等のクレート選定からcargo-distでの配布まで網羅。

2. Next.js 15のServer Actionsを本番投入して分かったこと（Qiita / ❤️ 180）
   > Server Actionsを実プロダクトで使った知見をまとめた記事。

...（計5件）
```

### メール配信（毎朝 6:00 / 夕方 18:00）

```
@you
📧 Mail Briefing - 2026/03/08（日）

━━━━━━━━━━━━━━━━━━━━
📧 要確認メール
━━━━━━━━━━━━━━━━━━━━

1. セキュリティ — Google アカウントへの新しいログイン
   > 送信者: Google（no-reply@accounts.google.com）
   > 宛先: you@gmail.com
   > 新しい Windows デバイスからのログインが検出されました。
   > 心当たりがない場合はパスワードの変更を推奨。

2. カード利用 — 3月7日のご利用通知（5,480円）
   > 送信者: 三井住友カード（info@smbc-card.com）
   > 宛先: you@gmail.com
   > Amazon.co.jp での5,480円の決済通知。

受信メール87件を全件確認済み。内訳は以下の通りです：
• ニュースレター・広告: 62件
• システム通知: 18件
• 要確認（上記記載）: 2件
• その他: 5件

> 急ぎの対応が必要なメールはありません。
```

## Features

- **ニュース収集**: Yahoo!ニュース、NHK、時事通信、ITmedia、GIGAZINE 等の RSS フィードから主要ニュースを自動取得
- **テック記事**: Qiita / Zenn のトレンド記事を API で取得（ON/OFF 可能）
- **メール確認**: Gmail MCP 経由で受信メールを確認し、要対応メールを要約（ON/OFF 可能）
- **AI 要約**: Codex または Claude Code がニュースを選定・要約し、Slack に配信

## 仕組みの全体像

3つのスケジュールジョブ（launchd Agent または cron）で動作する。

```
05:00  ニュースタスク
06:00  メールタスク
18:00  メールタスク
```

### ニュースタスク（05:00）

3フェーズで処理される。

1. **データ取得**: `node src/fetch-news.js` で RSS/API からニュースを取得し、`data/news-data.json` に保存
2. **AI 選定・要約**: `AI_PROVIDER` で選択した Codex または Claude Code がニュースを選定・要約し、`data/news-output.txt` に出力
3. **Slack 送信**: シェルスクリプトが `node src/slack-webhook.js` で Slack Webhook に送信

### メールタスク（06:00 / 18:00）

- 選択したAIが接続済みの Gmail コネクタ経由でメールを読み取り、要確認メールを `data/mail-output.txt` に出力。シェルスクリプトが Slack に送信
- こちらは一日２回実行される

## 前提条件

- macOS（launchd Agent を使う場合）
- Node.js 20 以上
- Codex CLI（既定。`codex --version` で確認）
- Claude Code CLI（`AI_PROVIDER=claude` を使用する場合。`claude --version` で確認）
- Slack Incoming Webhook URL（ニュース用・メール用の 2 つ）
- （メール機能を使う場合）選択したAIの Gmail コネクタが接続済み
- `jq`（AIのJSONLログ整形に使用。Codex実行は未導入でも可能）

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
SLACK_WEBHOOK_URL_NEWS=https://hooks.slack.com/services/XXX/YYY/ZZZ
SLACK_WEBHOOK_URL_MAIL=https://hooks.slack.com/services/AAA/BBB/CCC
SLACK_USER_ID=U0123456789
AI_PROVIDER=codex             # codex（既定）または claude
# CODEX_MODEL=              # 未指定時はCodex CLIのデフォルト
CODEX_TIMEOUT=1200
CODEX_RETRY_MAX=3
# CLAUDE_MODEL=             # sonnet / opus / フルモデルID
CLAUDE_TIMEOUT=1200
CLAUDE_RETRY_MAX=3
ENABLE_TECH_FEEDS=true
ENABLE_MAIL_DIGEST=true
```

> ニュースとメールは別々の Slack チャンネルに配信される。同じチャンネルに送りたい場合は両方に同じ Webhook URL を設定すればよい。

Codex は保存済みのCLI認証を `codex exec` でも再利用する。スケジュールを登録するmacOSユーザーで、事前に次の確認を行うこと。

```bash
codex login status
codex plugin list
```

`gmail@openai-curated` が `installed, enabled` でない場合は、Codex のプラグイン管理からインストール・有効化・接続を行う。

Claude Codeを使用する場合は `.env` を `AI_PROVIDER=claude` に変更する。Claude側は移行前の実装を保持しており、`CLAUDE_MODEL=sonnet` / `opus` またはフルモデルIDを指定できる。スケジュール実行ユーザーで認証とGmailコネクタを準備すること。

```bash
claude auth status
```

### 3. Gmail 認証設定（メール機能を使う場合）

Codex の Gmail プラグインを読み取り用途で使用する。

1. `codex plugin list` で `gmail@openai-curated` が `installed, enabled` であることを確認
2. Codex の設定画面で Gmail アカウントを接続
3. 非対話実行でもGmailツールが見えることを確認

```bash
codex exec --ephemeral --sandbox read-only \
  "ファイルやメールを変更せず、Gmailの検索・読み取りツールが利用可能かだけ簡潔に答えてください。"
```

日次スクリプトは `--sandbox read-only --ask-for-approval never` で Codex を起動する。Codex自身はローカルファイルやメールボックスを変更せず、最終回答のファイル保存とSlack送信はシェルスクリプト側が行う。

`AI_PROVIDER=claude` の場合は従来の Claude Code 用Gmail MCP、専用タスク、OAuth warmup、リトライ処理を使用する。Claudeは出力ファイルのみを書き込み、Slack送信は同じくシェルスクリプト側が行う。

### 4. スケジュール実行の設定

#### 方法 A: launchd Agent（推奨・macOS のみ）

launchd Agent はユーザーのログインセッションで実行されるため、選択したAI CLIの保存済み認証を再利用できる。ジョブ名は既存の `com.codex-daily-digest.*` を維持するが、実際に使うAIは `.env` の `AI_PROVIDER` で決まる。

`launchd/*.plist.example` をコピーしてパスを自分の環境に合わせて編集する。

```bash
# Codexジョブ用plistを作成（Claude互換テンプレートもlaunchd/に残してある）
for f in launchd/com.codex-daily-digest.*.plist.example; do cp "$f" "${f%.example}"; done
# エディタで各 .plist 内のパスを自分の環境に書き換える

# インストール
cp launchd/*.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.codex-daily-digest.news.plist
launchctl load ~/Library/LaunchAgents/com.codex-daily-digest.mail.plist
```

```bash
# 手動トリガー（動作確認用）
launchctl start com.codex-daily-digest.news
launchctl start com.codex-daily-digest.mail
```

```bash
# アンインストール
launchctl unload ~/Library/LaunchAgents/com.codex-daily-digest.news.plist
launchctl unload ~/Library/LaunchAgents/com.codex-daily-digest.mail.plist
rm ~/Library/LaunchAgents/com.codex-daily-digest.*.plist
```

> **launchd の注意点**
> - plist 内のパスは絶対パスで記述すること（`~` は使えない）
> - Mac スリープ中はジョブが実行されないが、スリープ復帰後にスケジュール済みタスクが自動実行される
> - Codex認証が失効した場合は、ターミナルで `codex login` を実行して再認証する
> - Claude認証が失効した場合は、ターミナルで `claude login` を実行して再認証する
> - Gmail接続が失効した場合は、選択中のAI側でGmailを再接続する
> - ログは `data/logs/launchd-*.log` に出力される
> - ステータス確認: `launchctl list | grep codex-daily-digest`

#### 方法 B: crontab

cronも同じmacOSユーザーの保存済みAI CLI認証を利用する。KeychainやGmail接続が見えない実行環境ではlaunchdを使用する。

```bash
crontab -e
```

`crontab.example` の内容をコピーし、パスを自分の環境に合わせて編集する。

> **cron の注意点**
> - PATH に `node` と選択するAI CLI（`codex`または`claude`）のパスが必要。`crontab.example` の PATH 行を参照
> - `~` は使えない。必ず絶対パス（`/Users/...` や `/home/...`）で記述すること
> - 設定は永続的。一度登録すれば PC 再起動後も残る
> - ただし **PC がスリープ中・電源オフの時刻のジョブは実行されない**（復帰後の自動実行もなし）
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
├── run-news.sh        # ニュース実行ラッパー
├── run-mail.sh        # メール実行ラッパー
├── format-codex-log.sh  # Codex JSONLログ整形
├── format-session-log.sh # Claude stream-jsonログ整形
└── lib/
    ├── retry-codex.sh   # Codexタイムアウト時リトライ
    └── retry-claude.sh  # Claudeタイムアウト時リトライ
launchd/
├── com.codex-daily-digest.news.plist.example  # launchd Agent テンプレート（ニュース）
├── com.codex-daily-digest.mail.plist.example  # launchd Agent テンプレート（メール）
├── com.claude-daily-digest.news.plist.example # 旧Claude互換テンプレート
└── com.claude-daily-digest.mail.plist.example # 旧Claude互換テンプレート
tasks/
├── news-task.md          # Codex用ニュース選定プロンプト
├── mail-task.md          # Codex用メール確認プロンプト
├── news-task-claude.md   # 旧Claude用ニュース選定プロンプト
└── mail-task-claude.md   # 旧Claude用メール確認プロンプト
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

# 一時的にClaudeを選択
AI_PROVIDER=claude ./scripts/run-mail.sh

# テスト
npm test
```

## ライセンス

MIT
