import dotenv from 'dotenv';
import { crawlNewsList, crawlNewsDetail, saveNewsToFile, NewsItem } from './crawler.js';
import { transformNewsBatch, saveTransformedArticles, TransformedArticle } from './transformer.js';
import { publishBatch } from './publisher.js';
import { log, getRecentLogs } from './logger.js';

dotenv.config();

/**
 * 主工作流：抓取 -> 改写 -> 发布
 */
async function main() {
  console.log('=== 微信公众号内容生成与发布工作流 ===\n');
  log('INFO', '工作流启动');

  const count = parseInt(process.argv[2] || '3'); // 默认处理3条
  const themeId = process.argv[3] || 'default'; // 默认主题

  try {
    // 步骤1: 爬取新闻列表
    console.log('\n📰 步骤1: 爬取新闻列表');
    console.log('-------------------------------');
    const newsList = await crawlNewsList(count);

    if (newsList.length === 0) {
      console.error('未找到新闻，退出');
      process.exit(1);
    }

    // 保存原始新闻
    await saveNewsToFile(newsList);

    // 步骤2: 爬取详情并改写
    console.log('\n✍️ 步骤2: 爬取详情并AI改写');
    console.log('-------------------------------');

    for (const news of newsList) {
      if (!news.content) {
        const { content, imageUrl } = await crawlNewsDetail(news.url);
        news.content = content;
        if (!news.imageUrl && imageUrl) {
          news.imageUrl = imageUrl;
        }
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 保存带详情的新闻
    await saveNewsToFile(newsList, 'news-with-content.json');

    // AI 改写
    const articles = await transformNewsBatch(newsList);

    // 保存改写后的文章
    const outputDir = './output';
    const savedFiles = await saveTransformedArticles(articles, outputDir);

    // 步骤3: 发布到微信公众号
    console.log('\n📤 步骤3: 发布到微信公众号草稿箱');
    console.log('-------------------------------');
    console.log(`主题: ${themeId}`);
    console.log(`待发布文件数: ${savedFiles.length}`);

    // 由于 wenyan-mcp 需要在 Claude Desktop 中运行，这里只生成文件
    // 实际发布需要通过 MCP 工具调用
    console.log('\n✅ 文章已生成到 output/ 目录');
    console.log('📌 下一步: 使用 Claude Desktop + wenyan-mcp 发布文章');
    console.log('   命令示例: 使用 publish_article 工具选择 output/ 下的 .md 文件发布');

    // 如果环境配置正确，尝试发布
    let publishResult = { success: [] as string[], failed: [] as string[] };
    const publishEnabled = process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET;
    if (publishEnabled && savedFiles.length > 0) {
      console.log('\n尝试自动发布...');
      publishResult = await publishBatch(savedFiles, themeId);
      console.log(`\n发布结果:`);
      console.log(`  成功: ${publishResult.success.length}`);
      console.log(`  失败: ${publishResult.failed.length}`);
      if (publishResult.failed.length > 0) {
        console.log(`  失败列表: ${publishResult.failed.join(', ')}`);
      }
    } else {
      console.log('\n⚠️ 未配置微信公众号凭证，跳过自动发布');
      console.log('请在 .env 文件中配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
    }

    log('SUCCESS', '工作流完成', {
      newsCount: newsList.length,
      published: publishResult.success.length,
      failed: publishResult.failed.length
    });
    console.log('\n=== 工作流完成 ===');
  } catch (error) {
    log('ERROR', '工作流执行失败', { error: String(error) });
    console.error('工作流执行失败:', error);
    process.exit(1);
  }
}

// 导出单独步骤的函数供其他模块使用
export { crawlNewsList, crawlNewsDetail, transformNewsBatch, publishBatch };

// 运行
main();
