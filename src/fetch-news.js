const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { fetchFeed } = require('./rss-feed');
const { fetchQiitaTrending, fetchZennTrending } = require('./tech-feed');
const { deduplicateArticles } = require('./articles');

async function fetchNewsAndSave(outputPath) {
  const startTime = new Date();
  const cutoff = new Date(startTime.getTime() - CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000);

  const rssResult = await fetchAllRssFeeds(cutoff);

  const emptyResult = { articles: [], errors: [], feedResults: [] };
  const qiitaResult = CONFIG.ENABLE_TECH_FEEDS
    ? await fetchTrending('Qiita', fetchQiitaTrending)
    : emptyResult;
  const zennResult = CONFIG.ENABLE_TECH_FEEDS
    ? await fetchTrending('Zenn', fetchZennTrending)
    : emptyResult;

  const allArticles = [
    ...rssResult.articles,
    ...qiitaResult.articles,
    ...zennResult.articles,
  ];
  const errors = [
    ...rssResult.errors,
    ...qiitaResult.errors,
    ...zennResult.errors,
  ];
  const feedResults = [
    ...rssResult.feedResults,
    ...qiitaResult.feedResults,
    ...zennResult.feedResults,
  ];

  const totalBeforeDedup = allArticles.length;
  const deduped = deduplicateArticles(allArticles);

  const output = {
    meta: {
      fetchedAt: startTime.toISOString(),
      totalArticlesBeforeDedup: totalBeforeDedup,
      totalArticlesAfterDedup: deduped.length,
      errors,
      feedResults,
    },
    articles: deduped,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

async function fetchAllRssFeeds(cutoff) {
  const articles = [];
  const errors = [];
  const feedResults = [];

  for (const feed of CONFIG.RSS_FEEDS) {
    try {
      const fetched = await fetchFeed(feed, cutoff);
      articles.push(...fetched);
      feedResults.push({
        source: feed.source,
        category: feed.category,
        articlesFound: fetched.length,
        status: 'ok',
      });
    } catch (e) {
      const errMsg = `${feed.source} (${feed.category}): ${e.message}`;
      errors.push(errMsg);
      feedResults.push({
        source: feed.source,
        category: feed.category,
        articlesFound: 0,
        status: 'error',
        error: errMsg,
      });
    }
  }

  return { articles, errors, feedResults };
}

async function fetchTrending(sourceName, fetchFn) {
  const articles = [];
  const errors = [];
  const feedResults = [];

  try {
    const fetched = await fetchFn();
    articles.push(...fetched);
    feedResults.push({
      source: sourceName,
      category: 'テック記事',
      articlesFound: fetched.length,
      status: 'ok',
    });
  } catch (e) {
    const errMsg = `${sourceName} API: ${e.message}`;
    errors.push(errMsg);
    feedResults.push({
      source: sourceName,
      category: 'テック記事',
      articlesFound: 0,
      status: 'error',
      error: errMsg,
    });
  }

  return { articles, errors, feedResults };
}

if (require.main === module) {
  const outputPath = process.argv[2] || path.join(__dirname, '..', 'data', 'news-data.json');
  fetchNewsAndSave(outputPath)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchNewsAndSave };
