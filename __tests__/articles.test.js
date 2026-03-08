const { deduplicateArticles } = require('../src/articles');

function createArticle(overrides) {
  return {
    title: 'テスト記事タイトル',
    url: 'https://example.com/article',
    publishedAt: '2026-03-05T00:00:00Z',
    publishedAtJST: '2026/03/05 09:00 JST',
    summary: 'テスト要約テキスト',
    source: 'テストソース',
    category: '主要',
    ...overrides,
  };
}

describe('deduplicateArticles', () => {
  describe('正常系', () => {
    it('重複のない記事リストをそのまま返すこと', () => {
      // Given
      const articles = [
        createArticle({ title: '記事A', url: 'https://example.com/a' }),
        createArticle({ title: '記事B', url: 'https://example.com/b' }),
        createArticle({ title: '記事C', url: 'https://example.com/c' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(3);
    });

    it('タイトル先頭 30 文字が同一の記事を重複として排除すること', () => {
      // Given: 先頭30文字が同一で末尾が異なる2記事
      const prefix = 'あ'.repeat(30);
      const articles = [
        createArticle({ title: prefix + '末尾A', summary: '短い' }),
        createArticle({ title: prefix + '末尾B', summary: '短い要約' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
    });

    it('重複記事のうち summary が長い方を残すこと', () => {
      // Given
      const prefix = 'あ'.repeat(30);
      const articles = [
        createArticle({ title: prefix + 'A', summary: '短い' }),
        createArticle({ title: prefix + 'B', summary: 'これは長い要約テキストです' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('これは長い要約テキストです');
    });

    it('先に出現した記事が後の重複より summary が長い場合はそのまま残すこと', () => {
      // Given
      const prefix = 'あ'.repeat(30);
      const articles = [
        createArticle({ title: prefix + 'A', summary: 'これは長い要約テキストです' }),
        createArticle({ title: prefix + 'B', summary: '短い' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('これは長い要約テキストです');
    });
  });

  describe('タイトル正規化', () => {
    it('空白文字を除去して比較すること', () => {
      // Given
      const articles = [
        createArticle({ title: 'テスト 記事 タイトル テキスト です' }),
        createArticle({ title: 'テスト記事タイトルテキストです', summary: 'longer' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
    });

    it('括弧類を除去して比較すること', () => {
      // Given
      const articles = [
        createArticle({ title: '「テスト」記事（タイトル）テキストです' }),
        createArticle({ title: 'テスト記事タイトルテキストです', summary: 'longer' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
    });

    it('全角スペースを除去して比較すること', () => {
      // Given
      const articles = [
        createArticle({ title: 'テスト\u3000記事\u3000タイトルテキストです' }),
        createArticle({ title: 'テスト記事タイトルテキストです', summary: 'longer' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
    });
  });

  describe('境界値', () => {
    it('空の配列に対して空の配列を返すこと', () => {
      // When
      const result = deduplicateArticles([]);

      // Then
      expect(result).toEqual([]);
    });

    it('1 件の記事に対してそのまま返すこと', () => {
      // Given
      const articles = [createArticle()];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
    });

    it('タイトルが 30 文字未満でも正規化して重複判定すること', () => {
      // Given
      const articles = [
        createArticle({ title: '短い', summary: '短い要約' }),
        createArticle({ title: '短い', summary: 'もっと長い要約テキスト' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('もっと長い要約テキスト');
    });
  });

  describe('エッジケース', () => {
    it('同じ summary 長の重複は先に出現した記事を残すこと', () => {
      // Given
      const articles = [
        createArticle({ title: '同じタイトル', summary: '同じ長さ', source: 'ソースA' }),
        createArticle({ title: '同じタイトル', summary: '同じ長さ', source: 'ソースB' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('ソースA');
    });

    it('3 件以上の重複で最も summary が長い記事を残すこと', () => {
      // Given
      const articles = [
        createArticle({ title: '同じタイトルのテスト記事', summary: '短' }),
        createArticle({ title: '同じタイトルのテスト記事', summary: 'これが一番長い要約テキスト' }),
        createArticle({ title: '同じタイトルのテスト記事', summary: '中くらい' }),
      ];

      // When
      const result = deduplicateArticles(articles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('これが一番長い要約テキスト');
    });
  });
});
