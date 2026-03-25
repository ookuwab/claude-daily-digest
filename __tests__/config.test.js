const CONFIG = require('../src/config');

describe('config', () => {
  describe('RSS_FEEDS', () => {
    it('Qiita の RSS エントリが含まれないこと', () => {
      const qiitaFeeds = CONFIG.RSS_FEEDS.filter(
        feed => feed.source === 'Qiita'
      );
      expect(qiitaFeeds).toHaveLength(0);
    });

    it('Zenn の RSS エントリが含まれないこと', () => {
      const zennFeeds = CONFIG.RSS_FEEDS.filter(
        feed => feed.source === 'Zenn'
      );
      expect(zennFeeds).toHaveLength(0);
    });

    it('各エントリに url, source, category が定義されていること', () => {
      for (const feed of CONFIG.RSS_FEEDS) {
        expect(feed).toHaveProperty('url');
        expect(feed).toHaveProperty('source');
        expect(feed).toHaveProperty('category');
        expect(feed.url).toBeTruthy();
        expect(feed.source).toBeTruthy();
        expect(feed.category).toBeTruthy();
      }
    });

    it('主要な RSS フィードソースが維持されること', () => {
      const sources = CONFIG.RSS_FEEDS.map(f => f.source);
      expect(sources).toContain('Yahoo!ニュース');
      expect(sources).toContain('NHK');
      expect(sources).toContain('時事通信');
      expect(sources).toContain('音楽ナタリー');
      expect(sources).toContain('お笑いナタリー');
      expect(sources).toContain('ITmedia');
      expect(sources).toContain('GIGAZINE');
    });
  });

  describe('Qiita API 設定', () => {
    it('QIITA_API_URL が定義されていること', () => {
      expect(CONFIG.QIITA_API_URL).toBe('https://qiita.com/api/v2/items');
    });

    it('QIITA_PER_PAGE が 30 であること', () => {
      expect(CONFIG.QIITA_PER_PAGE).toBe(30);
    });

    it('QIITA_TRENDING_DAYS が 3 であること', () => {
      expect(CONFIG.QIITA_TRENDING_DAYS).toBe(3);
    });

    it('QIITA_MIN_LIKES が 5 であること', () => {
      expect(CONFIG.QIITA_MIN_LIKES).toBe(5);
    });
  });

  describe('Zenn API 設定', () => {
    it('ZENN_API_URL が定義されていること', () => {
      expect(CONFIG.ZENN_API_URL).toBe('https://zenn.dev/api/articles');
    });

    it('ZENN_PER_PAGE が 20 であること', () => {
      expect(CONFIG.ZENN_PER_PAGE).toBe(20);
    });
  });

  describe('Slack 設定', () => {
    it('SLACK_WEBHOOK_URL_NEWS が Slack Webhook URL 形式であること', () => {
      expect(CONFIG.SLACK_WEBHOOK_URL_NEWS).toMatch(
        /^https:\/\/hooks\.slack\.com\/services\//
      );
    });

    it('SLACK_WEBHOOK_URL_MAIL が Slack Webhook URL 形式であること', () => {
      expect(CONFIG.SLACK_WEBHOOK_URL_MAIL).toMatch(
        /^https:\/\/hooks\.slack\.com\/services\//
      );
    });

    it('SLACK_MAX_LENGTH が 5000 であること', () => {
      expect(CONFIG.SLACK_MAX_LENGTH).toBe(5000);
    });
  });

  describe('共通設定', () => {
    it('MAX_AGE_HOURS が 24 であること', () => {
      expect(CONFIG.MAX_AGE_HOURS).toBe(24);
    });
  });
});
