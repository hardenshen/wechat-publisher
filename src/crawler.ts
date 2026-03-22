import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface NewsItem {
  title: string;
  summary: string;
  content: string;
  url: string;
  imageUrl: string | null;
  publishDate: string;
}

const NEWS_URL = 'https://www.cyclingnews.com/news/';
const RSS_URL = 'https://www.cyclingnews.com/feeds/articletype/news/';

/**
 * 通过 RSS 爬取新闻列表（更可靠）
 */
export async function crawlNewsList(count: number = 5): Promise<NewsItem[]> {
  console.log(`正在通过 RSS 获取 ${RSS_URL} ...`);

  try {
    const response = await axios.get(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const newsList: NewsItem[] = [];

    $('item').each((i, el) => {
      if (i >= count) return false;

      const $el = $(el);
      const title = $el.find('title').text().trim();
      const link = $el.find('link').text().trim();
      const description = $el.find('description').text().trim();
      const pubDate = $el.find('pubDate').text().trim();

      // 尝试从 description 中提取图片
      const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      // 清理 description 的 HTML
      const summary = description.replace(/<[^>]+>/g, '').trim();

      if (title && link) {
        newsList.push({
          title,
          summary: summary.substring(0, 200),
          content: '',
          url: link,
          imageUrl,
          publishDate: pubDate || new Date().toISOString(),
        });
      }
    });

    console.log(`通过 RSS 共找到 ${newsList.length} 条新闻`);
    return newsList;

  } catch (error) {
    console.error('RSS 获取失败，尝试网页解析:', error);
    return await crawlNewsListFromPage(count);
  }
}

/**
 * 从网页爬取新闻列表（备用方案）
 */
async function crawlNewsListFromPage(count: number = 5): Promise<NewsItem[]> {
  console.log(`正在爬取网页 ${NEWS_URL} ...`);

  const response = await axios.get(NEWS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);
  const newsList: NewsItem[] = [];

  // 尝试多种选择器
  const selectors = [
    '.article-item',
    '.news-item',
    '.listingResult',
    'article',
    '.card',
    '.story-card',
  ];

  let found = false;
  for (const selector of selectors) {
    if (found) break;
    $(selector).each((i, el) => {
      if (i >= count) return false;

      const $el = $(el);
      const titleEl = $el.find('h2, h3, h4').first();
      const title = titleEl.text().trim();
      const linkEl = $el.find('a').first();
      const url = linkEl.attr('href') || '';
      const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
      const summary = $el.find('p, .summary, .deck').first().text().trim();

      if (title && url) {
        const fullUrl = url.startsWith('http') ? url : `https://www.cyclingnews.com${url}`;
        newsList.push({
          title,
          summary,
          content: '',
          url: fullUrl,
          imageUrl,
          publishDate: new Date().toISOString(),
        });
        found = true;
      }
    });
  }

  if (newsList.length === 0) {
    console.log('使用直接链接解析...');
    // 最后的备用方案：直接解析所有新闻链接
    $('a[href*="/news/"]').each((i, el) => {
      if (i >= count * 2) return false;
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href') || '';
      if (text.length > 10 && href.includes('/news/') && !href.includes('cyclingnews.com/news/')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.cyclingnews.com${href}`;
        newsList.push({
          title: text,
          summary: '',
          content: '',
          url: fullUrl,
          imageUrl: null,
          publishDate: new Date().toISOString(),
        });
      }
    });
  }

  // 去重
  const unique = newsList.filter((item, index, self) =>
    index === self.findIndex(t => t.url === item.url)
  );

  console.log(`从网页共找到 ${unique.length} 条新闻`);
  return unique.slice(0, count);
}

/**
 * 爬取单条新闻详情（同时提取封面图片）
 */
export async function crawlNewsDetail(url: string): Promise<{ content: string; imageUrl: string | null }> {
  console.log(`正在爬取详情页: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // 移除干扰元素
    $('script, style, nav, footer, aside, .ad, .advertisement, .sidebar, .comments, .social-share, .related-articles, .newsletter-signup').remove();

    // 提取封面图片（article 或 main 中的第一张图片）
    let imageUrl: string | null = null;
    const imageSelectors = ['article img', 'main img', '.article-body img', '.news-body img', '.content img'];
    for (const selector of imageSelectors) {
      const img = $(selector).first();
      imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
      if (imageUrl && !imageUrl.includes('logo') && !imageUrl.includes('icon')) break;
    }
    // 备选：从 meta og:image 获取
    if (!imageUrl) {
      imageUrl = $('meta[property="og:image"]').attr('content') || null;
    }

    // 多种内容选择器
    const contentSelectors = [
      '.article-body',
      '.news-body',
      '.article__body',
      '.story-body',
      '.text-copy',
      'article',
      '.content',
      'main',
      '#content',
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const el = $(selector);
      content = el.text().trim();
      if (content.length > 200) break;
    }

    // 如果内容太短，获取所有段落
    if (content.length < 200) {
      const paragraphs: string[] = [];
      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.join('\n\n');
    }

    // 清理内容
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return { content, imageUrl };

  } catch (error) {
    console.error(`爬取详情页失败: ${url}`, error);
    return { content: '', imageUrl: null };
  }
}

/**
 * 保存新闻到本地文件
 */
export async function saveNewsToFile(news: NewsItem[], filename: string = 'news-raw.json'): Promise<void> {
  await fs.writeFile(filename, JSON.stringify(news, null, 2), 'utf-8');
  console.log(`已保存到 ${filename}`);
}
