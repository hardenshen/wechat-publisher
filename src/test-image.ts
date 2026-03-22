import dotenv from 'dotenv';
import { crawlNewsDetail } from './crawler.js';

dotenv.config();

async function main() {
  const url = 'https://www.cyclingnews.com/pro-cycling/teams-riders/spur-of-the-moment-decision-lands-wout-van-aert-fourth-career-podium-at-milan-san-remo-as-he-surprises-with-effort-from-late-crash/';
  const { content, imageUrl } = await crawlNewsDetail(url);
  console.log('imageUrl:', imageUrl);
  console.log('content length:', content.length);
}

main();
