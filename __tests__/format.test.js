const {
  toJSTDate,
  formatJST,
  toISODateString,
} = require('../src/format');

describe('format', () => {
  describe('toJSTDate', () => {
    it('UTC 時刻に +9 時間オフセットを加えた Date を返すこと', () => {
      // Given
      const utcDate = new Date('2026-03-05T00:00:00Z');

      // When
      const jstDate = toJSTDate(utcDate);

      // Then: UTC メソッドで JST の時刻値が取得できる
      expect(jstDate.getUTCHours()).toBe(9);
      expect(jstDate.getUTCDate()).toBe(5);
    });

    it('日付をまたぐ場合に JST 日付が正しいこと', () => {
      // Given: UTC 20:00 → JST 翌日 05:00
      const utcDate = new Date('2026-03-05T20:00:00Z');

      // When
      const jstDate = toJSTDate(utcDate);

      // Then
      expect(jstDate.getUTCDate()).toBe(6);
      expect(jstDate.getUTCHours()).toBe(5);
    });
  });

  describe('formatJST', () => {
    it('YYYY/MM/DD HH:mm JST 形式で返すこと', () => {
      // Given
      const date = new Date('2026-03-05T00:00:00Z');

      // When
      const result = formatJST(date);

      // Then: UTC 00:00 → JST 09:00
      expect(result).toBe('2026/03/05 09:00 JST');
    });

    it('月・日・時・分が 1 桁の場合にゼロ埋めされること', () => {
      // Given: 2026-01-02T00:05:00Z → JST 09:05
      const date = new Date('2026-01-02T00:05:00Z');

      // When
      const result = formatJST(date);

      // Then
      expect(result).toBe('2026/01/02 09:05 JST');
    });

    it('日付をまたぐ場合に JST の日付で表示されること', () => {
      // Given: UTC 2026-03-01T20:00:00Z → JST 2026-03-02T05:00:00
      const date = new Date('2026-03-01T20:00:00Z');

      // When
      const result = formatJST(date);

      // Then
      expect(result).toBe('2026/03/02 05:00 JST');
    });
  });

  describe('toISODateString', () => {
    it('YYYY-MM-DD 形式のローカル日付文字列を返すこと', () => {
      // Given
      const date = new Date(2026, 2, 5); // 2026年3月5日（ローカル）

      // When
      const result = toISODateString(date);

      // Then
      expect(result).toBe('2026-03-05');
    });

    it('月・日が 1 桁の場合にゼロ埋めされること', () => {
      // Given
      const date = new Date(2026, 0, 2); // 2026年1月2日（ローカル）

      // When
      const result = toISODateString(date);

      // Then
      expect(result).toBe('2026-01-02');
    });
  });
});
