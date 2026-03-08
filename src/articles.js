const DEDUP_KEY_LENGTH = 30;

function normalizeTitle(title) {
  return title
    .replace(/\s+/g, '')
    .replace(/[「」『』【】（）()]/g, '')
    .replace(/\u3000/g, '')
    .substring(0, DEDUP_KEY_LENGTH);
}

function deduplicateArticles(articles) {
  const seen = new Map();
  const result = [];

  for (const article of articles) {
    const key = normalizeTitle(article.title);

    if (!seen.has(key)) {
      seen.set(key, result.length);
      result.push(article);
    } else {
      const existingIdx = seen.get(key);
      if (article.summary.length > result[existingIdx].summary.length) {
        result[existingIdx] = article;
      }
    }
  }

  return result;
}

module.exports = { deduplicateArticles };
