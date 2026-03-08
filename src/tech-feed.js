const CONFIG = require('./config');
const { formatJST, toISODateString } = require('./format');

const QIITA_SUMMARY_MAX_LENGTH = 200;

async function fetchQiitaTrending() {
  const now = new Date();
  const trendingFrom = new Date(now.getTime() - CONFIG.QIITA_TRENDING_DAYS * 24 * 60 * 60 * 1000);
  const trendingDate = toISODateString(trendingFrom);
  const queryValue = `stocks:>${CONFIG.QIITA_MIN_LIKES} created:>${trendingDate}`;
  const url = `${CONFIG.QIITA_API_URL}?page=1&per_page=${CONFIG.QIITA_PER_PAGE}&query=${encodeURIComponent(queryValue)}`;

  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`);
  }

  const items = JSON.parse(await response.text());
  if (!Array.isArray(items)) {
    throw new Error('Unexpected response format');
  }

  items.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));

  return items.map(item => ({
    title: item.title || '',
    url: item.url || '',
    publishedAt: item.created_at || '',
    publishedAtJST: item.created_at ? formatJST(new Date(item.created_at)) : '',
    summary: stripMarkdown(item.body || ''),
    source: 'Qiita',
    category: 'テック記事',
    likes: item.likes_count || 0,
    stocks: item.stocks_count || 0,
    tags: (item.tags || []).map(t => t.name),
  }));
}

function stripMarkdown(text) {
  let result = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!?\[.*?\]\(.*?\)/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (result.length > QIITA_SUMMARY_MAX_LENGTH) {
    result = result.substring(0, QIITA_SUMMARY_MAX_LENGTH) + '...';
  }
  return result;
}

async function fetchZennTrending() {
  const url = `${CONFIG.ZENN_API_URL}?order=daily&article_type=tech&count=${CONFIG.ZENN_PER_PAGE}`;

  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = JSON.parse(await response.text());
  if (!data.articles || !Array.isArray(data.articles)) {
    throw new Error('Unexpected response format');
  }

  return data.articles.map(article => ({
    title: article.title || '',
    url: `https://zenn.dev${article.path}`,
    publishedAt: article.published_at || '',
    publishedAtJST: article.published_at ? formatJST(new Date(article.published_at)) : '',
    summary: '',
    source: 'Zenn',
    category: 'テック記事',
    likes: article.liked_count || 0,
  }));
}

module.exports = { fetchQiitaTrending, fetchZennTrending };
