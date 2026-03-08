const { XMLParser } = require('fast-xml-parser');
const { formatJST } = require('./format');

const SUMMARY_MAX_LENGTH = 500;

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  isArray: (name) => ['item', 'entry'].includes(name),
});

async function fetchFeed(feed, cutoff) {
  const response = await fetch(feed.url);

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} (URL: ${feed.url})`);
  }

  const contentText = await response.text();
  if (!contentText || contentText.trim().length === 0) {
    throw new Error(`Empty response (URL: ${feed.url})`);
  }

  const parsed = parser.parse(contentText);
  const rawItems = extractItems(parsed);

  const articles = [];
  for (const item of rawItems) {
    const article = parseItem(item, parsed);
    if (!article) continue;

    if (article.publishedAt && article.publishedAt >= cutoff) {
      articles.push({
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt.toISOString(),
        publishedAtJST: formatJST(article.publishedAt),
        summary: article.summary,
        source: feed.source,
        category: feed.category,
      });
    }
  }

  return articles;
}

function extractItems(parsed) {
  if (parsed.rss) {
    const channel = parsed.rss.channel;
    return channel?.item || [];
  }
  if (parsed.RDF) {
    return parsed.RDF.item || [];
  }
  if (parsed.feed) {
    return parsed.feed.entry || [];
  }
  return [];
}

function parseItem(item, parsed) {
  let title, url, pubDateStr, summary;

  if (parsed.feed) {
    title = item.title || '';
    url = extractAtomLink(item.link);
    pubDateStr = item.published || item.updated || '';
    summary = item.summary || item.content || '';
  } else {
    title = item.title || '';
    url = item.link || '';
    pubDateStr = item.pubDate || item.date || '';
    summary = item.description || '';
  }

  if (!title && !url) return null;

  summary = String(summary).replace(/<[^>]*>/g, '').trim();
  if (summary.length > SUMMARY_MAX_LENGTH) {
    summary = summary.substring(0, SUMMARY_MAX_LENGTH) + '...';
  }

  const publishedAt = pubDateStr ? new Date(pubDateStr) : null;

  return {
    title: String(title).trim(),
    url: String(url).trim(),
    publishedAt: isNaN(publishedAt?.getTime()) ? null : publishedAt,
    summary,
  };
}

function extractAtomLink(link) {
  if (!link) return '';
  if (Array.isArray(link)) {
    const alt = link.find(l => l['@_rel'] === 'alternate' || !l['@_rel']);
    return alt ? (alt['@_href'] || '') : (link[0]?.['@_href'] || '');
  }
  if (typeof link === 'object') {
    return link['@_href'] || '';
  }
  return String(link);
}

module.exports = { fetchFeed };
