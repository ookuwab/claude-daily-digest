const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FORMATTER_PATH = path.join(PROJECT_ROOT, 'scripts/format-codex-log.sh');

describe('format-codex-log.sh', () => {
  it('Codexの最終メッセージと完了時の使用量を読みやすく表示すること', () => {
    // Given: Codex exec --json が返すJSONLイベント
    const input = [
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_1', type: 'agent_message', text: '処理が完了しました。' },
      }),
      JSON.stringify({
        type: 'turn.completed',
        usage: { input_tokens: 120, output_tokens: 30 },
      }),
    ].join('\n');

    // When: フォーマッターへJSONLを渡す
    const result = spawnSync('bash', [FORMATTER_PATH], {
      encoding: 'utf8',
      input,
    });

    // Then: 最終メッセージとトークン数が表示される
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('処理が完了しました。');
    expect(result.stdout).toContain('[Turn complete]');
    expect(result.stdout).toContain('input: 120');
    expect(result.stdout).toContain('output: 30');
  });

  it('MCPツール呼び出しと失敗イベントを表示すること', () => {
    // Given: Gmailツール呼び出しとターン失敗のJSONLイベント
    const input = [
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'mcp_tool_call',
          server: 'gmail',
          tool: 'search_emails',
          status: 'completed',
        },
      }),
      JSON.stringify({
        type: 'turn.failed',
        error: { message: 'authentication failed' },
      }),
    ].join('\n');

    // When: フォーマッターへJSONLを渡す
    const result = spawnSync('bash', [FORMATTER_PATH], {
      encoding: 'utf8',
      input,
    });

    // Then: ツール名と失敗理由が診断可能な形で表示される
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[MCP: gmail/search_emails]');
    expect(result.stdout).toContain('[Turn failed] authentication failed');
  });
});
