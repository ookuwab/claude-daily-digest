# News Briefing Task

ローカルファイルからニュースデータを読み、選定・要約してファイルに書き出す。
Slack送信はシェルスクリプトが行うため、Claudeは送信を行わないこと。

## Step 1: ニュースデータ読み込み

`Read` ツールで `data/news-data.json` を読み取る。

データ構造:
```json
{
  "meta": { "fetchedAt": "...", "errors": [], "feedResults": [] },
  "articles": [
    {
      "title": "記事タイトル",
      "url": "URL",
      "publishedAtJST": "YYYY/MM/DD HH:MM JST",
      "summary": "要約",
      "source": "NHK / Yahoo!ニュース / Qiita / Zenn 等",
      "category": "主要 / 国際 / テック記事 等",
      "likes": 123,
      "tags": ["tag1"]
    }
  ]
}
```

## Step 2: ニュース選定（最大15件）

### 優先度

| 優先度 | ジャンル | 目安 |
|---|---|---|
| 高 | 国際・政治・経済・社会 | 8〜10件 |
| 高 | 音楽・お笑い・文化 | 3〜4件 |
| 高 | IT・科学・テクノロジー | 2〜3件 |
| 低 | スポーツ | 原則除外（オリンピック・重大不祥事等のみ） |

RSSのcategoryが「エンタメ」「主要」等の大括りの場合はタイトルから判断し、スポーツ記事は除外。

### 選定ルール

- 同一ジャンルから4件以上は避ける（大型ニュースのクラスター化は許容: メイン1件＋関連1〜2件にまとめ、メインは5〜7文で詳述）
- `publishedAtJST` が24時間以上前の記事は除外
- 各記事について3〜5文の詳細要約を書く（記事の中身がわかるように）
- summary < 100文字の記事はWebSearchで補完。関連トピックはまとめて1回の検索で効率化
- ファクトチェック: 2つ以上のソースで裏付け。クエリ例: `"キーワード" YYYY年M月D日`

## Step 3: テック記事選定（5件）

articlesから`category`が`テック記事`（`source` が `Qiita` または `Zenn`）の記事を抽出し、以下の基準で5件選定する。

- likes/stocksが多い記事を優先
- 実用的・教育的価値の高い記事を優先
- 幅広いトピックをカバーする（AI系ばかりにしない）
- タイトル＋1〜2文の要約＋URLで十分（ニュースほど詳述不要）

Qiita/Zennデータがない場合のフォールバック: WebSearchで `site:qiita.com OR site:zenn.dev トレンド YYYY年M月` を検索。

## Step 4: ファイル出力

以下のテンプレートでメッセージを作成し、`Write` ツールで `data/news-output.txt` に書き出すこと。

### テンプレート

```
<@{{SLACK_USER_ID}}>
:sunrise: *Morning Briefing - YYYY/MM/DD（曜日）*

━━━━━━━━━━━━━━━━━━━━
:newspaper: *本日の主要ニュース（15件）*
━━━━━━━━━━━━━━━━━━━━

*1.* :絵文字: *ニュースタイトル*
> 詳細な要約（3〜5文）。記事の中身がわかるように。
> <URL|ソース名> / <URL|ソース名>

*2.* :絵文字: *ニュースタイトル*
> 詳細な要約...
> <URL|ソース名>

（以下15件まで同様）

━━━━━━━━━━━━━━━━━━━━
:bulb: *Tech Picks（Qiita / Zenn）*
━━━━━━━━━━━━━━━━━━━━

*1.* <URL|記事タイトル>（Qiita / :heart: XX）
> 1〜2文の要約

*2.* <URL|記事タイトル>（Zenn / :heart: XX）
> 1〜2文の要約

（以下5件まで同様）
```

### 絵文字の例

:rotating_light: 速報 / :boom: 紛争 / :classical_building: 政治 / :globe_with_meridians: 国際 / :moneybag: 経済 / :bank: 金融 / :scales: 法律 / :japan: 国内 / :computer: IT / :guitar: 音楽 / :microphone: エンタメ / :laughing: お笑い / :fuelpump: エネルギー / :house: 社会
