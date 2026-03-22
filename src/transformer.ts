import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const DASHSCOPE_URL = process.env.DASHSCOPE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'deepseek-v3.2';
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

export interface NewsItem {
  title: string;
  summary: string;
  content: string;
  url: string;
  imageUrl: string | null;
  publishDate: string;
}

export interface TransformedArticle {
  frontmatter: {
    title: string;
    cover: string;
    author: string;
    source_url: string;
  };
  content: string; // Markdown 格式
}

/**
 * 调用 DeepSeek API 进行翻译和改写
 */
async function callDeepSeek(prompt: string): Promise<string> {
  if (!DASHSCOPE_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY 未设置');
  }

  const response = await axios.post(
    `${DASHSCOPE_URL}/chat/completions`,
    {
      model: DASHSCOPE_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一位专业的微信公众号内容编辑，擅长将英文新闻翻译并改写成适合微信公众号的中文文章。
要求：
1. 翻译准确、流畅，符合中文阅读习惯
2. 保留原文的核心信息和关键数据
3. 添加吸引读者的导语
4. 使用微信公众号风格的标题（吸引人但不夸张，20字以内）
5. 如有必要，可以适当补充背景信息
6. 输出格式：严格按以下格式输出，第一行是中文标题，第二行是空行，第三行开始是正文内容
格式：
[中文标题]

[正文内容]`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      },
      timeout: 60000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * 改写单条新闻为微信公众号文章
 */
export async function transformNewsToArticle(news: NewsItem): Promise<TransformedArticle> {
  console.log(`正在改写: ${news.title}`);

  // 组合原文内容
  const originalContent = `
标题: ${news.title}
原文链接: ${news.url}
发布时间: ${news.publishDate}
导语: ${news.summary}
正文:
${news.content}
`.trim();

  // 调用 AI 改写
  const transformedContent = await callDeepSeek(originalContent);

  // 解析 AI 输出：第一行是中文标题，后面是正文
  const lines = transformedContent.split('\n').filter(line => line.trim() !== '');
  const chineseTitle = lines[0].trim();
  const bodyContent = lines.slice(1).join('\n\n').trim();

  // 生成符合微信公众号格式的 Markdown
  // 微信公众号标题限制64字节，中文约32字
  const truncateTitle = (title: string, maxLen: number = 64): string => {
    if (title.length <= maxLen) return title;
    return title.substring(0, maxLen - 3) + '...';
  };
  const safeTitle = truncateTitle(chineseTitle).replace(/'/g, "''");
  const coverLine = news.imageUrl ? `cover: ${news.imageUrl}` : '';
  const markdown = `---
title: '${safeTitle}'
${coverLine}
author: 微信公众号助手
source_url: ${news.url}
---

${bodyContent}

---

📢 **来源**: [Cyclingnews](${news.url})

免责声明：本文由 AI 自动改写，旨在传递信息，不代表本公众号立场。`;

  return {
    frontmatter: {
      title: chineseTitle,
      cover: news.imageUrl || '',
      author: '微信公众号助手',
      source_url: news.url,
    },
    content: markdown,
  };
}

/**
 * 批量改写新闻
 */
export async function transformNewsBatch(newsList: NewsItem[]): Promise<TransformedArticle[]> {
  const results: TransformedArticle[] = [];

  for (const news of newsList) {
    try {
      const article = await transformNewsToArticle(news);
      results.push(article);
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`改写失败: ${news.title}`, error);
    }
  }

  return results;
}

/**
 * 保存改写后的文章到文件
 */
export async function saveTransformedArticles(
  articles: TransformedArticle[],
  outputDir: string = './output'
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const filenames: string[] = [];

  for (const article of articles) {
    // 使用标题作为文件名（去掉特殊字符）
    const safeTitle = article.frontmatter.title
      .replace(/[<>:"/\\|?*]/g, '')
      .substring(0, 50);
    const filename = path.join(outputDir, `${safeTitle}.md`);
    await fs.writeFile(filename, article.content, 'utf-8');
    filenames.push(filename);
    console.log(`已保存: ${filename}`);
  }

  return filenames;
}
