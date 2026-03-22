# 微信公众号内容生成与发布工作流

基于 cyclingnews 热门新闻，自动抓取、AI 改写、发布到微信公众号草稿箱。

## 功能特点

- 📰 **自动抓取** - 从 cyclingnews.com RSS 获取最新自行车赛新闻
- ✍️ **AI 改写** - 使用 DeepSeek API 将英文新闻翻译改写为中文公众号文章
- 📤 **一键发布** - 通过 wenyan-mcp MCP 工具发布到微信公众号草稿箱

## 项目结构

```
wechat-publisher/
├── src/
│   ├── crawler.ts      # 新闻抓取（RSS + 网页）
│   ├── transformer.ts  # AI 改写（DeepSeek API）
│   ├── publisher.ts    # 发布到公众号
│   ├── index.ts        # 主入口
│   └── test.ts         # 测试脚本
├── output/             # 生成的 Markdown 文章
├── package.json
├── tsconfig.json
└── .env.example       # 配置文件模板
```

## 快速开始

### 1. 安装依赖

```bash
cd wechat-publisher
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，编辑 `.env` 文件：

```env
# 微信公众号
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的AppSecret

# 阿里云 DashScope API
DASHSCOPE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=deepseek-v3.2
DASHSCOPE_API_KEY=你的APIKey
```

### 3. 全局安装 wenyan-mcp

```bash
npm install -g @wenyan-md/mcp
```

### 4. 运行完整工作流

```bash
# 处理 3 条新闻，使用 default 主题
npm start 3 default

# 或手动分步执行
npm run crawl      # 爬取新闻
npm run transform  # AI 改写
npm run publish    # 发布到公众号
```

### 5. 在 Claude Desktop 中发布

生成的文章在 `output/` 目录，使用前需要：

1. 确保 Claude Desktop 已配置 wenyan-mcp：

   ```json
   {
     "mcpServers": {
       "wenyan-mcp": {
         "command": "wenyan-mcp",
         "env": {
           "WECHAT_APP_ID": "你的AppID",
           "WECHAT_APP_SECRET": "你的AppSecret"
         }
       }
     }
   }
   ```

2. 在 Claude Desktop 对话中发送：

   ```
   使用 default 主题发布 output/你生成的文章.md 到微信公众号
   ```

3. Claude 会调用 wenyan-mcp 的 publish_article 工具完成发布

## 微信公众号 IP 白名单

发布前请确保运行机器的 IP 已加入微信公众号后台的 IP 白名单。

配置路径：微信公众号后台 → 设置与开发 → 基本配置 → IP 白名单

## 可用主题

- default - 默认
- orangeheart - 橙心
- rainbow - 彩虹
- lapis - 蓝宝石
- pie - 派
- maize - 玉米
- purple - 紫罗兰
- phycat - 物理喵

## 定时任务

后续可通过 crontab 或系统任务计划程序定时运行：

```bash
# 每天早上 9 点运行
0 9 * * * cd /path/to/wechat-publisher && npm start 3 default
```

Windows 可使用任务计划程序或 nssm 将脚本注册为 Windows 服务。
