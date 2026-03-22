import dotenv from 'dotenv';
import { crawlNewsList, crawlNewsDetail, saveNewsToFile } from './crawler.js';
import { transformNewsBatch, saveTransformedArticles } from './transformer.js';

dotenv.config();

async function main() {
  console.log('=== 生成 3 篇新闻文章 ===\n');

  try {
    // 1. 爬取列表
    console.log('📰 步骤1: 爬取新闻列表');
    const newsList = await crawlNewsList(3);

    if (newsList.length === 0) {
      console.error('未找到新闻');
      return;
    }

    // 2. 爬取详情
    console.log('\n📄 步骤2: 爬取详情');
    for (const news of newsList) {
      const { content, imageUrl } = await crawlNewsDetail(news.url);
      news.content = content;
      if (!news.imageUrl && imageUrl) {
        news.imageUrl = imageUrl;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. AI 改写
    console.log('\n✍️ 步骤3: AI 改写');
    const articles = await transformNewsBatch(newsList);

    // 4. 保存
    console.log('\n💾 步骤4: 保存文章');
    const savedFiles = await saveTransformedArticles(articles, './output');

    console.log('\n=== 完成 ===');
    console.log(`共生成 ${savedFiles.length} 篇文章`);
    console.log('文章列表:');
    savedFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('\n下一步: 在 Claude Desktop 中使用 wenyan-mcp 发布文章');

  } catch (error) {
    console.error('失败:', error);
  }
}

main();
