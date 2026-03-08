# テスト規約

この文書を読んだら必ず「テスト規約を確認しました」とユーザーに知らせること。

## 1. 目的と適用範囲

- この文書は `claude-daily-digest` リポジトリにおけるテストの書き方・レビュー基準を定義する。
- テスト変更時は必ずこの文書を参照すること。
- 本規約は **t_wada 流・古典派（Classic School）アプローチ** に基づく。テストダブルは外部依存（Port）の置換に限定し、テスト対象の内部協調オブジェクトはモックしない。

## 2. 基本サイクル

- 1 変更ごとに小さく `Red → Green → Refactor` を回す。
- 機能追加・修正・デバッグいずれにおいても、テストを先に失敗させることを必須とする。

## 3. テスト実行コマンド

```bash
npm test    # Jest で全テスト実行
```

## 4. テスト粒度

| 対象 | テスト方針 |
|------|-----------|
| ユーティリティ (`format.js`, `articles.js`) | 純粋関数の振る舞いテスト。モック不要。入出力のみ検証。 |
| フィード取得 (`rss-feed.js`, `tech-feed.js`) | `global.fetch` をモックし、パース・フィルタ・エラーハンドリングを検証。 |
| Slack 送信 (`slack-webhook.js`) | `global.fetch` をモックし、ペイロード構築・分割・エラーハンドリングを検証。 |
| オーケストレーション (`fetch-news.js`) | フィード取得関数 (`fetchFeed`, `fetchQiitaTrending`, `fetchZennTrending`) と `fs` をモック。これらは外部 HTTP 通信・ファイル I/O を行うポートであるため。ただし `deduplicateArticles` 等の内部ロジックはモックせず実物を使う。 |
| 設定 (`config.js`) | CONFIG 構造の妥当性検証（フィード定義、定数値）。 |
| 契約テスト (`run-scripts`, `task-files`) | シェルスクリプト・タスクファイルの内容を文字列検査し、設定ドリフトを CI で検出する。 |

## 5. テスト配置と記法

- テストファイルは `__tests__/` ディレクトリに配置する。
- テストファイルとソースファイルは 1:1 で対応させる。ファイル名は `<ソースファイル名>.test.js` とする。
- 共通ヘルパーが複数テストファイルで重複する場合は `__tests__/helpers/` に切り出してよい。
- AAA（Arrange/Act/Assert）で記述し、Given/When/Then コメントを付ける。

```javascript
it('カットオフ以前の記事を除外すること', async () => {
  // Given: カットオフ日時より古い記事を含む RSS
  global.fetch.mockResolvedValue(createMockResponse(200, OLD_ARTICLE_XML));

  // When: フィード取得を実行
  const articles = await fetchFeed(FEED, CUTOFF);

  // Then: 古い記事が除外される
  expect(articles).toHaveLength(0);
});
```

- テスト間の順序依存・共有状態依存を禁止する。
- `beforeEach` / `afterEach` で `global.fetch` やタイマーを確実にリセットする。

## 6. モック戦略

### モックして良いもの（外部ポート）

| 対象 | 理由 |
|------|------|
| `global.fetch` | HTTP 通信（RSS, Qiita API, Zenn API, Slack Webhook） |
| `fs` モジュール | ファイル読み書き |
| `Date` / タイマー | `jest.useFakeTimers()` で日時固定 |

### モックしてはいけないもの（内部モジュール）

| 対象 | 理由 |
|------|------|
| `articles.js` (`deduplicateArticles`) | 内部ロジック。実物を通してテストする。 |
| `format.js` (`toJSTDate`, `formatJST`, `toISODateString`) | 純粋関数。 |
| `config.js` (`CONFIG` 定数) | 設定値。テスト側で必要に応じて参照する。 |

### 例外

`fetch-news.js` のテストで `fetchFeed`, `fetchQiitaTrending`, `fetchZennTrending` をモックするのは許容する。これらの関数は内部で `global.fetch` を呼ぶポート境界の関数であり、オーケストレーションロジック（エラー収集、重複排除、ファイル出力）を独立して検証するためである。

## 7. テスト名規約（テスト名＝仕様書）

- テスト名は日本語で「〜のとき、〜すること」「〜を〜すること」形式で振る舞いを表現する。
- `describe` の第一階層は関数名またはモジュール名、第二階層は「正常系」「異常系」「境界値」「エッジケース」などのカテゴリ。
- テスト名一覧を読むだけで、対応する仕様の要約として成立すること。
- 実装詳細ではなく、外部から観測可能な結果を検証する。

```javascript
// Good
describe('deduplicateArticles', () => {
  describe('正常系', () => {
    it('タイトル先頭30文字が一致する記事を重複として除去すること', () => { ... });
    it('重複時に要約が長い方の記事を残すこと', () => { ... });
  });
});

// Bad - 英語、実装詳細
it('should use normalizeTitle with DEDUP_KEY_LENGTH', () => { ... });
```

## 8. 必須テストカテゴリ

各モジュールについて以下のカテゴリを網羅する:

| カテゴリ | 内容 |
|---------|------|
| 正常系 | 主要な成功パス（標準的な入力で期待通りの出力） |
| 異常系 | エラーレスポンス、不正入力、ネットワーク障害 |
| 境界値 | 空配列、0 件、ちょうどの長さ、1 件 |
| エッジケース | null/undefined フィールド、特殊文字、巨大入力 |

## 9. 冪等性・テスト隔離

- 同じテストを何度実行しても結果が変わらないこと。
- 日時依存のテストは `jest.useFakeTimers()` で固定する。
- テスト間で共有状態を持たない。

## 10. テスト完了条件

- 変更に対応するテストが追加または更新されている。
- `npm test` が通る。
- 新規の外部依存を追加した場合、そのモック方針がこの文書に沿っていること。
