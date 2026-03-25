if (!process.env.SLACK_WEBHOOK_URL_NEWS || !process.env.SLACK_WEBHOOK_URL_MAIL) {
  throw new Error('SLACK_WEBHOOK_URL_NEWS and SLACK_WEBHOOK_URL_MAIL must be set. Copy .env.example to .env and configure it.');
}

const CONFIG = {
  MAX_AGE_HOURS: 24,

  QIITA_API_URL: 'https://qiita.com/api/v2/items',
  QIITA_PER_PAGE: 30,
  QIITA_MIN_LIKES: 5,
  QIITA_TRENDING_DAYS: 3,

  ZENN_API_URL: 'https://zenn.dev/api/articles',
  ZENN_PER_PAGE: 20,

  SLACK_WEBHOOK_URL_NEWS: process.env.SLACK_WEBHOOK_URL_NEWS,
  SLACK_WEBHOOK_URL_MAIL: process.env.SLACK_WEBHOOK_URL_MAIL,
  SLACK_MAX_LENGTH: 5000,

  ENABLE_TECH_FEEDS: process.env.ENABLE_TECH_FEEDS !== 'false',
  ENABLE_MAIL_DIGEST: process.env.ENABLE_MAIL_DIGEST !== 'false',

  RSS_FEEDS: [
    { url: 'https://news.yahoo.co.jp/rss/topics/top-picks.xml', source: 'Yahoo!ニュース', category: '主要' },
    { url: 'https://news.yahoo.co.jp/rss/topics/domestic.xml', source: 'Yahoo!ニュース', category: '国内' },
    { url: 'https://news.yahoo.co.jp/rss/topics/world.xml', source: 'Yahoo!ニュース', category: '国際' },
    { url: 'https://news.yahoo.co.jp/rss/topics/business.xml', source: 'Yahoo!ニュース', category: '経済' },
    { url: 'https://news.yahoo.co.jp/rss/topics/entertainment.xml', source: 'Yahoo!ニュース', category: 'エンタメ' },
    { url: 'https://news.yahoo.co.jp/rss/topics/it.xml', source: 'Yahoo!ニュース', category: 'IT・科学' },

    { url: 'https://www.nhk.or.jp/rss/news/cat0.xml', source: 'NHK', category: '主要' },
    { url: 'https://www.nhk.or.jp/rss/news/cat1.xml', source: 'NHK', category: '社会' },
    { url: 'https://www.nhk.or.jp/rss/news/cat4.xml', source: 'NHK', category: '政治' },
    { url: 'https://www.nhk.or.jp/rss/news/cat5.xml', source: 'NHK', category: '経済' },
    { url: 'https://www.nhk.or.jp/rss/news/cat6.xml', source: 'NHK', category: '国際' },

    { url: 'https://www.jiji.com/rss/ranking.rdf', source: '時事通信', category: 'ランキング' },

    { url: 'https://natalie.mu/music/feed/news', source: '音楽ナタリー', category: '音楽' },
    { url: 'https://natalie.mu/owarai/feed/news', source: 'お笑いナタリー', category: 'お笑い' },

    { url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml', source: 'ITmedia', category: 'IT・科学' },
    { url: 'https://gigazine.net/news/rss_2.0/', source: 'GIGAZINE', category: 'IT・科学' },
  ],
};

module.exports = CONFIG;
