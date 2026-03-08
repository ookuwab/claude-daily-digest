const { fetchQiitaTrending, fetchZennTrending } = require('../src/tech-feed');

function mockResponse(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, ok: status >= 200 && status < 300, text: async () => text };
}

function qiitaItem(overrides) {
  return {
    title: 'テスト記事', url: 'https://qiita.com/user/items/abc123',
    created_at: '2026-03-01T10:00:00+09:00', body: 'テスト本文',
    likes_count: 50, stocks_count: 20, tags: [{ name: 'JavaScript' }],
    ...overrides,
  };
}

function zennArticle(overrides) {
  return {
    id: 12345, title: 'Zennテスト記事', slug: 'test-article',
    path: '/testuser/articles/test-article', liked_count: 150,
    article_type: 'tech', published_at: '2026-03-01T10:00:00.000+09:00',
    user: { username: 'testuser', name: 'Test User' },
    ...overrides,
  };
}

describe('fetchQiitaTrending', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-02T00:00:00Z'));
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  describe('API URL 構築', () => {
    it('created フィルタに QIITA_TRENDING_DAYS 日前の日付を使用すること', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, [qiitaItem()]));
      await fetchQiitaTrending();
      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('created%3A%3E2026-02-27');
    });

    it('per_page に CONFIG.QIITA_PER_PAGE を使用すること', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, []));
      await fetchQiitaTrending();
      expect(global.fetch.mock.calls[0][0]).toContain('per_page=30');
    });
  });

  describe('正常系', () => {
    it('記事を likes_count 降順でソートして返すこと', async () => {
      const items = [
        qiitaItem({ title: 'A', likes_count: 10 }),
        qiitaItem({ title: 'B', likes_count: 100 }),
        qiitaItem({ title: 'C', likes_count: 50 }),
      ];
      global.fetch.mockResolvedValue(mockResponse(200, items));

      const result = await fetchQiitaTrending();

      expect(result[0].likes).toBe(100);
      expect(result[1].likes).toBe(50);
      expect(result[2].likes).toBe(10);
    });

    it('出力フォーマットが正しいこと', async () => {
      const items = [qiitaItem({
        title: 'テスト記事タイトル', url: 'https://qiita.com/user/items/abc',
        created_at: '2026-03-01T10:00:00+09:00', body: 'テスト本文テキスト',
        likes_count: 42, stocks_count: 15,
        tags: [{ name: 'JavaScript' }, { name: 'React' }],
      })];
      global.fetch.mockResolvedValue(mockResponse(200, items));

      const result = await fetchQiitaTrending();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'テスト記事タイトル', url: 'https://qiita.com/user/items/abc',
        publishedAt: '2026-03-01T10:00:00+09:00',
        publishedAtJST: expect.stringMatching(/2026\/03\/01 \d{2}:\d{2} JST/),
        summary: 'テスト本文テキスト', source: 'Qiita', category: 'テック記事',
        likes: 42, stocks: 15, tags: ['JavaScript', 'React'],
      });
    });

    it('Markdown 記法をサマリーから除去すること', async () => {
      const body = '# 見出し\nテスト**太字**\n```js\ncode\n```\n[リンク](url)\n![画像](url)';
      global.fetch.mockResolvedValue(mockResponse(200, [qiitaItem({ body })]));

      const result = await fetchQiitaTrending();

      expect(result[0].summary).not.toContain('#');
      expect(result[0].summary).not.toContain('**');
      expect(result[0].summary).not.toContain('```');
      expect(result[0].summary).not.toContain('[リンク]');
    });

    it('サマリーが 200 文字を超える場合に切り詰めること', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, [qiitaItem({ body: 'あ'.repeat(300) })])
      );
      const result = await fetchQiitaTrending();
      expect(result[0].summary.length).toBeLessThanOrEqual(203);
      expect(result[0].summary).toMatch(/\.\.\.$/);
    });
  });

  describe('異常系', () => {
    it('HTTP 200 以外のステータスコードでエラーをスローすること', async () => {
      global.fetch.mockResolvedValue(mockResponse(403, 'Forbidden'));
      await expect(fetchQiitaTrending()).rejects.toThrow(/HTTP 403/);
    });

    it('レスポンスが配列でない場合にエラーをスローすること', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, { message: 'error' }));
      await expect(fetchQiitaTrending()).rejects.toThrow(/Unexpected response format/);
    });
  });

  describe('境界値・エッジケース', () => {
    it('空の配列を返す場合に空の結果を返すこと', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, []));
      const result = await fetchQiitaTrending();
      expect(result).toEqual([]);
    });

    it('body が空文字・null の記事でもサマリーが空文字になること', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, [qiitaItem({ body: '' })]));
      expect((await fetchQiitaTrending())[0].summary).toBe('');

      global.fetch.mockResolvedValue(mockResponse(200, [qiitaItem({ body: null })]));
      expect((await fetchQiitaTrending())[0].summary).toBe('');
    });

    it('tags が空配列の記事でも空の tags 配列を返すこと', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, [qiitaItem({ tags: [] })]));
      const result = await fetchQiitaTrending();
      expect(result[0].tags).toEqual([]);
    });

    it('likes_count が未定義の記事でも likes が 0 になること', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, [qiitaItem({ likes_count: undefined })])
      );
      const result = await fetchQiitaTrending();
      expect(result[0].likes).toBe(0);
    });
  });
});

describe('fetchZennTrending', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('API URL 構築', () => {
    it('正しい API エンドポイントとパラメータを使用すること', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, { articles: [zennArticle()] })
      );
      await fetchZennTrending();

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://zenn.dev/api/articles');
      expect(calledUrl).toContain('order=daily');
      expect(calledUrl).toContain('article_type=tech');
      expect(calledUrl).toContain('count=20');
    });
  });

  describe('正常系', () => {
    it('フィールドマッピングが正しいこと', async () => {
      const article = zennArticle({
        title: 'テスト記事タイトル', path: '/user1/articles/my-article',
        liked_count: 200, published_at: '2026-03-01T10:00:00.000+09:00',
      });
      global.fetch.mockResolvedValue(mockResponse(200, { articles: [article] }));

      const result = await fetchZennTrending();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'テスト記事タイトル',
        url: 'https://zenn.dev/user1/articles/my-article',
        publishedAt: '2026-03-01T10:00:00.000+09:00',
        publishedAtJST: expect.stringMatching(/2026\/03\/01 \d{2}:\d{2} JST/),
        summary: '', source: 'Zenn', category: 'テック記事', likes: 200,
      });
    });

    it('path から正しい URL を構築すること', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, { articles: [zennArticle({ path: '/author/articles/some-slug' })] })
      );
      const result = await fetchZennTrending();
      expect(result[0].url).toBe('https://zenn.dev/author/articles/some-slug');
    });

    it('summary が空文字であること（API が本文を返さないため）', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, { articles: [zennArticle()] })
      );
      const result = await fetchZennTrending();
      expect(result[0].summary).toBe('');
    });

    it('複数記事を返すこと', async () => {
      const articles = [zennArticle({ title: '1' }), zennArticle({ title: '2' }), zennArticle({ title: '3' })];
      global.fetch.mockResolvedValue(mockResponse(200, { articles }));
      const result = await fetchZennTrending();
      expect(result).toHaveLength(3);
    });
  });

  describe('異常系', () => {
    it('HTTP 200 以外のステータスコードでエラーをスローすること', async () => {
      global.fetch.mockResolvedValue(mockResponse(500, 'Server Error'));
      await expect(fetchZennTrending()).rejects.toThrow(/HTTP 500/);
    });

    it('レスポンスに articles 配列がない場合にエラーをスローすること', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, { error: 'not found' }));
      await expect(fetchZennTrending()).rejects.toThrow();
    });
  });

  describe('境界値・エッジケース', () => {
    it('articles が空配列の場合に空の結果を返すこと', async () => {
      global.fetch.mockResolvedValue(mockResponse(200, { articles: [] }));
      const result = await fetchZennTrending();
      expect(result).toEqual([]);
    });

    it('liked_count が 0 の記事でも正しく処理されること', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, { articles: [zennArticle({ liked_count: 0 })] })
      );
      const result = await fetchZennTrending();
      expect(result[0].likes).toBe(0);
    });

    it('published_at が空の記事でもエラーにならないこと', async () => {
      global.fetch.mockResolvedValue(
        mockResponse(200, { articles: [zennArticle({ published_at: '' })] })
      );
      const result = await fetchZennTrending();
      expect(result).toHaveLength(1);
      expect(result[0].publishedAt).toBe('');
    });
  });
});
