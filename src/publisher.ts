import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { log } from './logger.js';

dotenv.config();

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

/**
 * 使用 wenyan-cli 发布文章到微信公众号
 */
export async function publishWithWenyanMcp(
  markdownFile: string,
  themeId: string = 'default'
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  return new Promise((resolve) => {
    const publishCmd = `npx`;
    const publishArgs = [
      '@wenyan-md/cli',
      'publish',
      '-f', markdownFile,
      '-t', themeId
    ];

    const fileName = path.basename(markdownFile);
    log('INFO', `开始发布`, { file: fileName, theme: themeId });

    const env = {
      ...process.env,
      WECHAT_APP_ID: WECHAT_APP_ID || '',
      WECHAT_APP_SECRET: WECHAT_APP_SECRET || '',
    };

    const proc = spawn(publishCmd, publishArgs, {
      env,
      shell: true,
      detached: true, // 分离进程，让它自己运行
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    // 收集输出
    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    // 检查是否成功
    const checkSuccess = () => {
      const successMatch = stdout.match(/发布成功[，,]?\s*Media\s*ID[:\s]*([a-zA-Z0-9_-]+)/i);
      const mediaIdMatch = stdout.match(/media[_\s]?id[:\s]*([a-zA-Z0-9_-]+)/i) || successMatch;
      if (successMatch || stdout.includes('发布成功')) {
        return mediaIdMatch ? mediaIdMatch[1] : undefined;
      }
      return undefined;
    };

    // 每5秒检查一次输出
    const interval = setInterval(() => {
      const mediaId = checkSuccess();
      if (mediaId && !resolved) {
        clearInterval(interval);
        try { process.kill(-proc.pid); } catch {}
        log('SUCCESS', `发布成功`, { file: fileName, mediaId });
        resolved = true;
        resolve({ success: true, mediaId });
      }
    }, 5000);

    // 等待进程结束
    proc.on('close', (code) => {
      clearInterval(interval);
      if (resolved) return;

      const mediaId = checkSuccess();
      if (mediaId || code === 0) {
        log('SUCCESS', `发布成功`, { file: fileName, mediaId });
        resolve({ success: true, mediaId });
      } else {
        const errorMsg = stderr || stdout || `exit code ${code}`;
        log('ERROR', `发布失败`, { file: fileName, error: errorMsg });
        resolve({ success: false, error: errorMsg });
      }
      resolved = true;
    });

    // 超时（5分钟）
    setTimeout(() => {
      clearInterval(interval);
      if (resolved) return;
      try { process.kill(-proc.pid); } catch {}
      const mediaId = checkSuccess();
      if (mediaId) {
        log('SUCCESS', `发布成功（超时后确认）`, { file: fileName, mediaId });
        resolve({ success: true, mediaId });
      } else {
        log('ERROR', `发布超时`, { file: fileName });
        resolve({ success: false, error: '发布超时' });
      }
    }, 300000);
  });
}

/**
 * 批量发布文章
 */
export async function publishBatch(
  markdownFiles: string[],
  themeId: string = 'default'
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const file of markdownFiles) {
    try {
      const result = await publishWithWenyanMcp(file, themeId);
      if (result.success) {
        success.push(file);
      } else {
        failed.push(`${file}: ${result.error}`);
      }
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      failed.push(`${file}: ${error}`);
    }
  }

  return { success, failed };
}

/**
 * 使用 MCP Inspector 方式调用（备选方案）
 */
export async function publishWithMcpInspector(
  markdownFile: string,
  themeId: string = 'default'
): Promise<void> {
  const content = await fs.readFile(markdownFile, 'utf-8');

  // MCP 调用格式
  const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'publish_article',
      arguments: {
        file: markdownFile,
        theme_id: themeId,
      },
    },
  };

  console.log('MCP Request:', JSON.stringify(mcpRequest, null, 2));
  console.log('提示: 请在 Claude Desktop 中使用 /publish 命令发布文章');
}
