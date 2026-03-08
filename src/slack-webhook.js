const CONFIG = require('./config');

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];

  const lines = text.split('\n');
  const chunks = [];
  let currentChunk = '';

  for (const line of lines) {
    if (line.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      for (let i = 0; i < line.length; i += maxLength) {
        chunks.push(line.substring(i, i + maxLength));
      }
      continue;
    }

    if (currentChunk === '') {
      currentChunk = line;
    } else if (currentChunk.length + 1 + line.length <= maxLength) {
      currentChunk += '\n' + line;
    } else {
      chunks.push(currentChunk);
      currentChunk = line;
    }
  }

  if (currentChunk !== '' || chunks.length === 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function sendSlackMessage(text, options = {}) {
  const chunks = splitMessage(text, CONFIG.SLACK_MAX_LENGTH);

  for (const chunk of chunks) {
    const payload = { text: chunk };
    if (options.username) payload.username = options.username;
    if (options.icon_emoji) payload.icon_emoji = options.icon_emoji;

    const response = await fetch(CONFIG.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack webhook failed: HTTP ${response.status} - ${body}`);
    }
  }
}

if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);

  let input;
  const options = {};
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--file' && args[i + 1]) {
      input = fs.readFileSync(args[i + 1], 'utf-8');
      i += 2;
    } else if (args[i] === '--username' && args[i + 1]) {
      options.username = args[i + 1];
      i += 2;
    } else if (args[i] === '--icon-emoji' && args[i + 1]) {
      options.icon_emoji = args[i + 1];
      i += 2;
    } else {
      i++;
    }
  }
  if (!input) {
    input = fs.readFileSync('/dev/stdin', 'utf-8');
  }

  sendSlackMessage(input, options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { sendSlackMessage, splitMessage };
