jest.mock('../src/rss-feed', () => ({
  fetchFeed: jest.fn(),
}));
jest.mock('../src/tech-feed', () => ({
  fetchQiitaTrending: jest.fn(),
  fetchZennTrending: jest.fn(),
}));
jest.mock('fs');

const { fetchNewsAndSave } = require('../src/fetch-news');
const { fetchFeed } = require('../src/rss-feed');
const { fetchQiitaTrending, fetchZennTrending } = require('../src/tech-feed');
const fs = require('fs');

function createArticle(overrides) {
  return {
    title: 'テスト記事',
    url: 'https://example.com/article',
    publishedAt: '2026-03-05T01:00:00Z',
    publishedAtJST: '2026/03/05 10:00 JST',
    summary: 'テスト要約',
    source: 'テストソース',
    category: '主要',
    ...overrides,
  };
}

describe('fetchNewsAndSave', () => {
  const OUTPUT_PATH = '/tmp/test-news-data.json';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-05T00:00:00Z'));

    fetchFeed.mockResolvedValue([createArticle()]);
    fetchQiitaTrending.mockResolvedValue([
      createArticle({ source: 'Qiita', category: 'テック記事' }),
    ]);
    fetchZennTrending.mockResolvedValue([
      createArticle({ source: 'Zenn', category: 'テック記事' }),
    ]);
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('オーケストレーション', () => {
    it('全 RSS フィードに対して fetchFeed を呼び出すこと', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then: CONFIG.RSS_FEEDS の数だけ呼ばれる
      expect(fetchFeed).toHaveBeenCalled();
      expect(fetchFeed.mock.calls.length).toBeGreaterThan(0);
    });

    it('Qiita トレンド取得を呼び出すこと', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      expect(fetchQiitaTrending).toHaveBeenCalledTimes(1);
    });

    it('Zenn トレンド取得を呼び出すこと', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      expect(fetchZennTrending).toHaveBeenCalledTimes(1);
    });

    it('重複する記事が排除されて出力されること', async () => {
      // Given: 全フィードが同じタイトルの記事を返す（重複発生）
      const duplicateArticle = createArticle({ title: '重複記事のタイトルテスト用ダミーテキストです', summary: '短い要約' });
      const duplicateWithLongerSummary = createArticle({ title: '重複記事のタイトルテスト用ダミーテキストです', summary: 'より長い要約テキストです', source: 'Qiita' });
      fetchFeed.mockResolvedValue([duplicateArticle]);
      fetchQiitaTrending.mockResolvedValue([duplicateWithLongerSummary]);
      fetchZennTrending.mockResolvedValue([]);

      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then: 重複排除により記事数が減少し、summary が長い方が残る
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData.meta.totalArticlesBeforeDedup).toBeGreaterThan(
        writtenData.meta.totalArticlesAfterDedup
      );
      expect(writtenData.meta.totalArticlesAfterDedup).toBe(1);
      expect(writtenData.articles[0].summary).toBe('より長い要約テキストです');
    });
  });

  describe('エラー収集', () => {
    it('RSS フィード取得失敗時もスクリプト全体は停止しないこと', async () => {
      // Given: 全 RSS フィードがエラー
      fetchFeed.mockRejectedValue(new Error('RSS fetch failed'));

      // When & Then: エラーにならない
      await expect(fetchNewsAndSave(OUTPUT_PATH)).resolves.not.toThrow();
    });

    it('Qiita API 失敗時もスクリプト全体は停止しないこと', async () => {
      // Given
      fetchQiitaTrending.mockRejectedValue(new Error('Qiita API unavailable'));

      // When & Then
      await expect(fetchNewsAndSave(OUTPUT_PATH)).resolves.not.toThrow();
    });

    it('Zenn API 失敗時もスクリプト全体は停止しないこと', async () => {
      // Given
      fetchZennTrending.mockRejectedValue(new Error('Zenn API unavailable'));

      // When & Then
      await expect(fetchNewsAndSave(OUTPUT_PATH)).resolves.not.toThrow();
    });

    it('全フィード失敗時でも出力ファイルが生成されること', async () => {
      // Given
      fetchFeed.mockRejectedValue(new Error('RSS failed'));
      fetchQiitaTrending.mockRejectedValue(new Error('Qiita failed'));
      fetchZennTrending.mockRejectedValue(new Error('Zenn failed'));

      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('エラーが meta.errors に記録されること', async () => {
      // Given
      fetchQiitaTrending.mockRejectedValue(new Error('Qiita API unavailable'));

      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData.meta.errors.length).toBeGreaterThan(0);
      const qiitaError = writtenData.meta.errors.find(e => e.includes('Qiita'));
      expect(qiitaError).toBeDefined();
    });

    it('フィード結果が meta.feedResults に記録されること', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData.meta.feedResults).toBeDefined();
      expect(writtenData.meta.feedResults.length).toBeGreaterThan(0);
    });

    it('失敗フィードの feedResults にエラーステータスが記録されること', async () => {
      // Given
      fetchZennTrending.mockRejectedValue(new Error('Zenn API unavailable'));

      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      const zennResult = writtenData.meta.feedResults.find(
        r => r.source === 'Zenn'
      );
      expect(zennResult).toBeDefined();
      expect(zennResult.status).toBe('error');
      expect(zennResult.articlesFound).toBe(0);
    });
  });

  describe('出力ファイル', () => {
    it('指定されたパスに JSON ファイルを書き出すこと', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [path] = fs.writeFileSync.mock.calls[0];
      expect(path).toBe(OUTPUT_PATH);
    });

    it('出力 JSON に articles と meta が含まれること', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData).toHaveProperty('articles');
      expect(writtenData).toHaveProperty('meta');
    });

    it('meta に fetchedAt が ISO 文字列で含まれること', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData.meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('meta に totalArticlesBeforeDedup と totalArticlesAfterDedup が含まれること', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
      expect(writtenData.meta).toHaveProperty('totalArticlesBeforeDedup');
      expect(writtenData.meta).toHaveProperty('totalArticlesAfterDedup');
    });

    it('出力 JSON が有効な JSON であること', async () => {
      // When
      await fetchNewsAndSave(OUTPUT_PATH);

      // Then
      const [, content] = fs.writeFileSync.mock.calls[0];
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('致命的エラー', () => {
    it('ファイル書き出し失敗時にエラーがリスローされること', async () => {
      // Given
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      // When & Then
      await expect(fetchNewsAndSave(OUTPUT_PATH)).rejects.toThrow(
        /permission denied/
      );
    });
  });
});
