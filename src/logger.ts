import fs from 'fs/promises';
import path from 'path';

const LOG_DIR = './logs';
const LOG_FILE = path.join(LOG_DIR, `publish-${new Date().toISOString().split('T')[0]}.log`);

export async function ensureLogDir(): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true });
}

export async function log(level: 'INFO' | 'ERROR' | 'SUCCESS', message: string, data?: any): Promise<void> {
  await ensureLogDir();

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };

  const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;

  await fs.appendFile(LOG_FILE, logLine, 'utf-8');

  // 同时输出到控制台
  const color = level === 'ERROR' ? '\x1b[31m' : level === 'SUCCESS' ? '\x1b[32m' : '\x1b[36m';
  console.log(`${color}[${level}]${message}${data ? ' ' + JSON.stringify(data) : ''}\x1b[0m`);
}

export async function getRecentLogs(lines: number = 50): Promise<string[]> {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}
