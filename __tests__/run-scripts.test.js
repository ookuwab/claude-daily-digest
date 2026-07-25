const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUN_NEWS_PATH = path.join(PROJECT_ROOT, 'scripts/run-news.sh');
const RUN_MAIL_PATH = path.join(PROJECT_ROOT, 'scripts/run-mail.sh');
const RETRY_CODEX_PATH = path.join(PROJECT_ROOT, 'scripts/lib/retry-codex.sh');
const RETRY_CLAUDE_PATH = path.join(PROJECT_ROOT, 'scripts/lib/retry-claude.sh');

describe.each([
  ['lib/retry-codex.sh', RETRY_CODEX_PATH, 'Codex'],
  ['lib/retry-claude.sh', RETRY_CLAUDE_PATH, 'Claude'],
])('%s', (_name, retryPath, providerName) => {
  const content = fs.readFileSync(retryPath, 'utf-8');

  it('timeout終了時だけ最大回数まで再実行すること', () => {
    // Given: Codex用の共通リトライライブラリ
    // When: リトライ条件とループを検査
    // Then: exit code 124 を10秒間隔で再実行する
    expect(content).toContain('retry_on_timeout()');
    expect(content).toMatch(/while\s/);
    expect(content).toMatch(/exit_code.*124|124.*exit_code/);
    expect(content).toContain('sleep 10');
  });

  it('最後の実行結果を呼び出し元へ返すこと', () => {
    // Given: 実行関数が失敗しうるリトライ処理
    // When: exit code の捕捉と返却を検査
    // Then: set -e に中断されず最後の結果を返す
    expect(content).toContain('|| exit_code=$?');
    expect(content).toContain('return "$exit_code"');
  });

  it('ログメッセージが選択中のプロバイダーを示すこと', () => {
    // Given: 各AIプロバイダー用の共通リトライライブラリ
    // When: timeoutログを検査
    // Then: 実行したプロバイダー名を記録する
    expect(content).toContain(`${providerName} timed out`);
  });
});

describe.each([
  ['run-news.sh', RUN_NEWS_PATH, 'SLACK_WEBHOOK_URL_NEWS', 'news-output.txt'],
  ['run-mail.sh', RUN_MAIL_PATH, 'SLACK_WEBHOOK_URL_MAIL', 'mail-output.txt'],
])('%s', (_name, scriptPath, webhookVariable, outputName) => {
  const content = fs.readFileSync(scriptPath, 'utf-8');

  it('未指定時はCodexを使用し、不正なプロバイダーを拒否すること', () => {
    // Given: AI_PROVIDERを省略または誤指定する可能性
    // When: プロバイダーの初期化と検証を検査
    // Then: Codexを既定値とし、codexとclaude以外はエラーにする
    expect(content).toContain('AI_PROVIDER="${AI_PROVIDER:-codex}"');
    expect(content).toContain('codex)');
    expect(content).toContain('claude)');
    expect(content).toContain('Unsupported AI_PROVIDER');
    expect(content).toContain('exit 2');
  });

  it('シェルで指定したAI_PROVIDERを.envより優先すること', () => {
    // Given: .envに既定値があり、一時的に別プロバイダーを指定する実行
    // When: .envの読み込み前後を検査
    // Then: 呼び出し元の環境変数を保持して選択に使う
    expect(content).toContain('AI_PROVIDER_OVERRIDE="${AI_PROVIDER-}"');
    expect(content).toContain('AI_PROVIDER="$AI_PROVIDER_OVERRIDE"');
  });

  it('Codex選択時は非対話・読み取り専用・一時セッションで実行すること', () => {
    // Given: launchdまたはcronから呼ばれる日次スクリプト
    // When: Codex CLIの起動オプションを検査
    // Then: 人の承認を待たず最小権限で一時実行する
    expect(content).toContain('codex');
    expect(content).toContain('exec');
    expect(content).toContain('--ephemeral');
    expect(content).toContain('--sandbox read-only');
    expect(content).toContain('--ask-for-approval never');
  });

  it('Claude選択時は従来の許可ツールとstream-jsonで実行すること', () => {
    // Given: AI_PROVIDER=claudeの日次実行
    // When: Claude CLIの起動オプションを検査
    // Then: 旧Claude実装と同じツール制約とJSONログを使う
    expect(content).toContain('claude -p');
    expect(content).toContain('--output-format stream-json');
    expect(content).toContain('format-session-log.sh');
  });

  it('Codexの最終回答を出力ファイルへ直接保存すること', () => {
    // Given: Slack送信用の出力ファイル
    // When: Codex実行前後の処理を検査
    // Then: 古い出力を削除して最終回答を新規保存する
    const rmIndex = content.indexOf('rm -f "$OUTPUT_FILE"');
    const codexIndex = content.indexOf('--output-last-message "$OUTPUT_FILE"');
    expect(content).toContain(`OUTPUT_FILE="$PROJECT_DIR/data/${outputName}"`);
    expect(content).toContain('--output-last-message "$OUTPUT_FILE"');
    expect(rmIndex).toBeGreaterThan(-1);
    expect(codexIndex).toBeGreaterThan(-1);
    expect(rmIndex).toBeLessThan(codexIndex);
  });

  it('CodexのJSONLイベントとstderrをログへ保存すること', () => {
    // Given: 非対話実行の診断ログ
    // When: JSONLとstderrの出力先を検査
    // Then: 生JSONLと人間向けログの両方を残す
    expect(content).toContain('--json');
    expect(content).toContain('tee "$JSONL_FILE"');
    expect(content).toContain('format-codex-log.sh');
    expect(content).toContain('2>>"$LOG_FILE"');
  });

  it('Codex成功時だけ出力ファイルをSlackへ送信すること', () => {
    // Given: Codexが生成するSlack本文
    // When: 成功条件とWebhook呼び出しを検査
    // Then: 対象チャンネルへファイル内容を送る
    expect(content).toMatch(/\[ (?:! )?-f "\$OUTPUT_FILE" \]/);
    expect(content).toContain('node "$PROJECT_DIR/src/slack-webhook.js" --file "$OUTPUT_FILE"');
    expect(content).toContain(`WEBHOOK_URL="$${webhookVariable}"`);
  });

  it('Codex用のタイムアウト設定と共通リトライ処理を使うこと', () => {
    // Given: 一時的なタイムアウトが起きうる日次実行
    // When: 環境変数と共通ライブラリを検査
    // Then: Codex用の設定名で最大3回まで試行する
    expect(content).toContain('CODEX_RETRY_MAX="${CODEX_RETRY_MAX:-3}"');
    expect(content).toContain('source "$SCRIPT_DIR/lib/retry-codex.sh"');
    expect(content).toContain(
      'retry_on_timeout "$LOG_FILE" "$CODEX_RETRY_MAX" run_codex',
    );
    expect(content).toContain('|| codex_exit=$?');
  });

  it('Claude用のタイムアウト設定と共通リトライ処理を使うこと', () => {
    // Given: Claude APIの一時的なタイムアウト
    // When: Claude用環境変数とライブラリを検査
    // Then: Codexとは独立した設定でリトライする
    expect(content).toContain('CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-1200}"');
    expect(content).toContain('CLAUDE_RETRY_MAX="${CLAUDE_RETRY_MAX:-3}"');
    expect(content).toContain('source "$SCRIPT_DIR/lib/retry-claude.sh"');
    expect(content).toContain(
      'retry_on_timeout "$LOG_FILE" "$CLAUDE_RETRY_MAX" run_claude',
    );
    expect(content).toContain('|| claude_exit=$?');
  });

  it('モデル未指定でもmacOS標準Bashで両プロバイダーを起動できること', () => {
    // Given: CODEX_MODELまたはCLAUDE_MODELが未指定で空の引数配列
    // When: AI起動時のモデル引数展開を検査
    // Then: Bash 3.2のset -uでも空配列を安全に展開する
    expect(content).toContain(
      '${CODEX_MODEL_ARGS[@]+"${CODEX_MODEL_ARGS[@]}"}',
    );
    expect(content).toContain(
      '${CLAUDE_MODEL_ARGS[@]+"${CLAUDE_MODEL_ARGS[@]}"}',
    );
    expect(content).not.toMatch(
      /^\s*"\$\{CODEX_MODEL_ARGS\[@\]\}"\s*\\$/m,
    );
    expect(content).not.toMatch(
      /^\s*"\$\{CLAUDE_MODEL_ARGS\[@\]\}"\s*\\$/m,
    );
  });

});

describe('run-news.sh', () => {
  const content = fs.readFileSync(RUN_NEWS_PATH, 'utf-8');

  it('最新記事の確認にCodexのライブWeb検索を有効にすること', () => {
    // Given: RSS要約の補完とファクトチェックを行うニュースタスク
    // When: Codex起動オプションを検査
    // Then: ライブWeb検索を利用可能にする
    expect(content).toContain('--search');
  });

  it('Codexまたは出力生成が失敗した場合にエラー終了すること', () => {
    // Given: Codex実行と出力ファイル生成
    // When: 失敗分岐を検査
    // Then: Slackへエラー通知して非0で終了する
    expect(content).toContain('notify_error');
    expect(content).toContain('exit "$ai_exit"');
    expect(content).toContain('[ ! -f "$OUTPUT_FILE" ]');
  });
});

describe('run-mail.sh', () => {
  const content = fs.readFileSync(RUN_MAIL_PATH, 'utf-8');

  it('Claude選択時だけOAuth warmupを実行すること', () => {
    // Given: ClaudeのGmailコネクタ認証を更新する必要がある
    // When: warmupの実行条件を検査
    // Then: Codex既定実行には影響させずClaude時だけ実行する
    expect(content).toContain('if [ "$AI_PROVIDER" = "claude" ]; then');
    expect(content).toContain('OAuth warmup');
    expect(content).toContain('Reply with OK');
  });

  it('前回成功時刻から重複を持たせてメールを取得すること', () => {
    // Given: 一時的な失敗後も取りこぼさないメールタスク
    // When: タスクテンプレートへの日時設定を検査
    // Then: 前回成功の1時間前を取得開始日時として渡す
    expect(content).toContain('FETCH_FROM_EPOCH=$((LAST_SUCCESS - 3600))');
    expect(content).toContain('{{FETCH_FROM_EPOCH}}');
    expect(content).toContain('{{FETCH_FROM_DATE}}');
  });

  it('処理失敗時はステータスを成功扱いせず非0で終了すること', () => {
    // Given: Codex・出力生成・Slack送信のいずれかの失敗
    // When: 失敗分岐を検査
    // Then: lastSuccessTimeを維持しlaunchdへ失敗を返す
    const failureIndex = content.indexOf('Status updated: failure');
    const exitIndex = content.indexOf('exit 1', failureIndex);
    expect(failureIndex).toBeGreaterThan(-1);
    expect(exitIndex).toBeGreaterThan(failureIndex);
  });
});
