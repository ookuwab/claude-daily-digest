const { fetchFeed } = require('../src/rss-feed');

const RSS_2_0_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>テストフィード</title>
    <item>
      <title>RSS2記事タイトル</title>
      <link>https://example.com/rss2-1</link>
      <pubDate>Thu, 05 Mar 2026 10:00:00 +0900</pubDate>
      <description>RSS2の要約テキスト</description>
    </item>
    <item>
      <title>古いRSS2記事</title>
      <link>https://example.com/rss2-old</link>
      <pubDate>Mon, 02 Mar 2026 10:00:00 +0900</pubDate>
      <description>古い記事の要約</description>
    </item>
  </channel>
</rss>`;

const RDF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>RDFテストフィード</title>
  </channel>
  <item>
    <title>RDF記事タイトル</title>
    <link>https://example.com/rdf-1</link>
    <dc:date>2026-03-05T10:00:00+09:00</dc:date>
    <description>RDFの要約テキスト</description>
  </item>
</rdf:RDF>`;

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atomテストフィード</title>
  <entry>
    <title>Atom記事タイトル</title>
    <link rel="alternate" href="https://example.com/atom-1"/>
    <published>2026-03-05T10:00:00+09:00</published>
    <summary>Atomの要約テキスト</summary>
  </entry>
</feed>`;

const SINGLE_ITEM_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>単一アイテムフィード</title>
    <item>
      <title>唯一の記事</title>
      <link>https://example.com/single</link>
      <pubDate>Thu, 05 Mar 2026 10:00:00 +0900</pubDate>
      <description>唯一の要約</description>
    </item>
  </channel>
</rss>`;

function createMockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  };
}

describe('rss-feed', () => {
  const originalFetch = global.fetch;
  const CUTOFF = new Date('2026-03-04T00:00:00Z');
  const FEED = { url: 'https://example.com/feed', source: 'テスト', category: '主要' };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('RSS 2.0 フォーマット', () => {
    it('RSS 2.0 XML をパースして記事を返すこと', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then: cutoff(3/4)以降の記事(3/5)のみ
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('RSS2記事タイトル');
      expect(articles[0].url).toBe('https://example.com/rss2-1');
      expect(articles[0].summary).toBe('RSS2の要約テキスト');
    });

    it('source と category がフィード定義から設定されること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles[0].source).toBe('テスト');
      expect(articles[0].category).toBe('主要');
    });

    it('publishedAt が ISO 文字列で設定されること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles[0].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('publishedAtJST が JST 形式で設定されること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles[0].publishedAtJST).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} JST/);
    });
  });

  describe('RDF/RSS 1.0 フォーマット', () => {
    it('RDF XML をパースして記事を返すこと', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, RDF_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('RDF記事タイトル');
      expect(articles[0].url).toBe('https://example.com/rdf-1');
      expect(articles[0].summary).toBe('RDFの要約テキスト');
    });
  });

  describe('Atom フォーマット', () => {
    it('Atom XML をパースして記事を返すこと', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, ATOM_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Atom記事タイトル');
      expect(articles[0].url).toBe('https://example.com/atom-1');
      expect(articles[0].summary).toBe('Atomの要約テキスト');
    });
  });

  describe('カットオフ日付フィルタリング', () => {
    it('カットオフ以前の記事を除外すること', async () => {
      // Given: RSS_2_0_XML には 3/5 と 3/2 の2記事
      // カットオフ 3/4 → 3/5 のみ通過
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('RSS2記事タイトル');
    });

    it('カットオフを古い日付にすると全記事が取得されること', async () => {
      // Given: カットオフを 3/1 に設定（両記事とも通過）
      const oldCutoff = new Date('2026-03-01T00:00:00Z');
      global.fetch.mockResolvedValue(createMockResponse(200, RSS_2_0_XML));

      // When
      const articles = await fetchFeed(FEED, oldCutoff);

      // Then
      expect(articles).toHaveLength(2);
    });
  });

  describe('異常系', () => {
    it('HTTP 200 以外のステータスコードでエラーをスローすること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(404, 'Not Found'));

      // When & Then
      await expect(fetchFeed(FEED, CUTOFF)).rejects.toThrow(/HTTP 404/);
    });

    it('HTTP 500 でエラーをスローすること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(500, 'Server Error'));

      // When & Then
      await expect(fetchFeed(FEED, CUTOFF)).rejects.toThrow(/HTTP 500/);
    });

    it('空のレスポンスでエラーをスローすること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, ''));

      // When & Then
      await expect(fetchFeed(FEED, CUTOFF)).rejects.toThrow();
    });

    it('不正な XML でエラーをスローすること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, '<invalid xml'));

      // When & Then
      await expect(fetchFeed(FEED, CUTOFF)).rejects.toThrow();
    });
  });

  describe('エッジケース', () => {
    it('アイテムが 1 つの XML でも配列として処理されること', async () => {
      // Given: fast-xml-parser の isArray オプションで配列化される
      global.fetch.mockResolvedValue(createMockResponse(200, SINGLE_ITEM_RSS));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('唯一の記事');
    });

    it('summary 内の HTML タグが除去されること', async () => {
      // Given
      const xmlWithHtml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>HTML記事</title>
      <link>https://example.com/html</link>
      <pubDate>Thu, 05 Mar 2026 10:00:00 +0900</pubDate>
      <description>&lt;p&gt;段落&lt;/p&gt;&lt;b&gt;太字&lt;/b&gt;テキスト</description>
    </item>
  </channel>
</rss>`;
      global.fetch.mockResolvedValue(createMockResponse(200, xmlWithHtml));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles[0].summary).not.toContain('<p>');
      expect(articles[0].summary).not.toContain('<b>');
    });

    it('summary が 500 文字を超える場合に切り詰められること', async () => {
      // Given
      const longDesc = 'あ'.repeat(600);
      const xmlWithLongDesc = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>長い記事</title>
      <link>https://example.com/long</link>
      <pubDate>Thu, 05 Mar 2026 10:00:00 +0900</pubDate>
      <description>${longDesc}</description>
    </item>
  </channel>
</rss>`;
      global.fetch.mockResolvedValue(createMockResponse(200, xmlWithLongDesc));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles[0].summary.length).toBeLessThanOrEqual(503);
      expect(articles[0].summary).toMatch(/\.\.\.$/);
    });

    it('pubDate が存在しない記事はフィルタされること', async () => {
      // Given
      const noPubDateXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>テスト</title>
    <item>
      <title>日付なし記事</title>
      <link>https://example.com/no-date</link>
      <description>日付なしの要約</description>
    </item>
  </channel>
</rss>`;
      global.fetch.mockResolvedValue(createMockResponse(200, noPubDateXml));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toEqual([]);
    });

    it('アイテムが 0 件の XML でも空配列を返すこと', async () => {
      // Given
      const emptyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>空</title></channel></rss>`;
      global.fetch.mockResolvedValue(createMockResponse(200, emptyRss));

      // When
      const articles = await fetchFeed(FEED, CUTOFF);

      // Then
      expect(articles).toEqual([]);
    });
  });
});
