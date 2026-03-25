const { sendSlackMessage, splitMessage } = require('../src/slack-webhook');

function createMockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  };
}

describe('splitMessage', () => {
  describe('正常系', () => {
    it('maxLength 以内のテキストを 1 チャンクで返すこと', () => {
      // Given
      const text = '短いメッセージ';

      // When
      const chunks = splitMessage(text, 5000);

      // Then
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('短いメッセージ');
    });

    it('改行位置で分割すること', () => {
      // Given: 各行 5 文字 × 3 行 = 15 文字、maxLength=10 で分割
      const text = 'AAAAA\nBBBBB\nCCCCC';

      // When
      const chunks = splitMessage(text, 10);

      // Then: 改行区切りで分割される
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(10);
      }
    });

    it('行の途中で切らないこと', () => {
      // Given: 行単位で分割される
      const text = '1234567890\nabcdefghij\nABCDEFGHIJ';

      // When
      const chunks = splitMessage(text, 15);

      // Then: 各チャンクが完全な行で構成される
      const allText = chunks.join('\n');
      expect(allText).toBe(text);
    });
  });

  describe('境界値', () => {
    it('空文字列に対して空文字列 1 チャンクを返すこと', () => {
      // When
      const chunks = splitMessage('', 5000);

      // Then
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('');
    });

    it('maxLength ちょうどのテキストを 1 チャンクで返すこと', () => {
      // Given
      const text = 'a'.repeat(100);

      // When
      const chunks = splitMessage(text, 100);

      // Then
      expect(chunks).toHaveLength(1);
    });

    it('maxLength + 1 のテキストを 2 チャンクに分割すること', () => {
      // Given: 50文字 + 改行 + 50文字 = 101文字
      const text = 'a'.repeat(50) + '\n' + 'b'.repeat(50);

      // When
      const chunks = splitMessage(text, 100);

      // Then
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('エッジケース', () => {
    it('単一行が maxLength を超える場合に強制分割すること', () => {
      // Given: 改行なしの長い行
      const text = 'あ'.repeat(6000);

      // When
      const chunks = splitMessage(text, 5000);

      // Then
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(5000);
      }
    });

    it('連続する改行を含むテキストを正しく分割すること', () => {
      // Given
      const text = 'AAA\n\n\nBBB';

      // When
      const chunks = splitMessage(text, 5000);

      // Then
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });
  });
});

describe('sendSlackMessage', () => {
  const originalFetch = global.fetch;
  const TEST_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST/URL/HERE';

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('正常系', () => {
    it('Webhook URL に POST リクエストを送信すること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));
      const text = 'テストメッセージ';

      // When
      await sendSlackMessage(text, { webhookUrl: TEST_WEBHOOK_URL });

      // Then
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe(TEST_WEBHOOK_URL);
      expect(options.method).toBe('POST');
    });

    it('Content-Type が application/json であること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));

      // When
      await sendSlackMessage('テスト', { webhookUrl: TEST_WEBHOOK_URL });

      // Then
      const [, options] = global.fetch.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('ペイロードが { text } 形式であること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));
      const message = 'テストメッセージ本文';

      // When
      await sendSlackMessage(message, { webhookUrl: TEST_WEBHOOK_URL });

      // Then
      const [, options] = global.fetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload).toEqual({ text: message });
    });

    it('5000 文字超のメッセージを複数リクエストに分割して送信すること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));
      const longLine = 'あ'.repeat(3000);
      const text = longLine + '\n' + longLine;

      // When
      await sendSlackMessage(text, { webhookUrl: TEST_WEBHOOK_URL });

      // Then
      expect(global.fetch.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('異常系', () => {
    it('HTTP エラーレスポンスでエラーをスローすること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(500, 'server_error'));

      // When & Then
      await expect(sendSlackMessage('テスト', { webhookUrl: TEST_WEBHOOK_URL })).rejects.toThrow();
    });

    it('fetch が reject した場合にエラーが伝播すること', async () => {
      // Given
      global.fetch.mockRejectedValue(new Error('Network error'));

      // When & Then
      await expect(sendSlackMessage('テスト', { webhookUrl: TEST_WEBHOOK_URL })).rejects.toThrow('Network error');
    });

    it('webhookUrl が未指定の場合にエラーをスローすること', async () => {
      // When & Then
      await expect(sendSlackMessage('テスト')).rejects.toThrow('webhookUrl is required');
    });
  });

  describe('options パラメータ', () => {
    it('options.username がペイロードに含まれること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));

      // When
      await sendSlackMessage('テスト', { webhookUrl: TEST_WEBHOOK_URL, username: 'test-bot' });

      // Then
      const [, options] = global.fetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload.username).toBe('test-bot');
    });

    it('options.icon_emoji がペイロードに含まれること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));

      // When
      await sendSlackMessage('テスト', { webhookUrl: TEST_WEBHOOK_URL, icon_emoji: ':robot_face:' });

      // Then
      const [, options] = global.fetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload.icon_emoji).toBe(':robot_face:');
    });
  });

  describe('エッジケース', () => {
    it('5000 文字ちょうどのメッセージを 1 リクエストで送信すること', async () => {
      // Given
      global.fetch.mockResolvedValue(createMockResponse(200, 'ok'));
      const text = 'a'.repeat(5000);

      // When
      await sendSlackMessage(text, { webhookUrl: TEST_WEBHOOK_URL });

      // Then
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
