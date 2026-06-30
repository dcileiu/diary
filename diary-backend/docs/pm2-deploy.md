# PM2 部署说明

这套后端推荐部署方式：

- 应用：`PM2 + Next.js`
- 数据库：`SQLite`（单文件，免单独部署数据库服务）
- Web 服务：`Nginx` 反向代理到 `4010`

## 环境变量

先复制环境变量示例：

```bash
cp .env.example .env
```

至少要改这些值：

- `PORT`
- `PUBLIC_SITE_ORIGIN`
- `PUBLIC_ASSET_ORIGIN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DATABASE_URL`
- `WECHAT_MINI_PROGRAM_APP_ID`
- `WECHAT_MINI_PROGRAM_SECRET`

### 图片存储（可选，Cloudflare R2）

不配则图片存到服务器本地 `public/uploads`（或 `UPLOAD_STORAGE_ROOT`）。要用 R2，配置：

- `R2_ACCOUNT_ID`（或直接给 `R2_ENDPOINT`）
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_UPLOAD_PREFIX`（可选，默认 `diary`）
- `PUBLIC_ASSET_ORIGIN` 指向 R2 的公开域名（`pub-xxx.r2.dev` 或绑定的自定义域名）

> R2 的 Access Key 在 Cloudflare 控制台「R2 → Manage R2 API Tokens」创建。配了 R2 后所有图片走 R2：头像存到 `<prefix>/avatar`，其他图片存到 `<prefix>/images`（默认即 `diary/avatar` 与 `diary/images`）。

## 首次上线命令顺序

在 `diary-backend` 目录执行：

```bash
npm install
```

```bash
cp .env.example .env
```

编辑 `.env`，填好生产环境配置。

确认 `.env` 里的 `DATABASE_URL`（SQLite 文件路径）已配置后，执行（首次会自动创建数据库文件）：

```bash
npm run db:deploy
```

首次初始化演示分类和标签时，再执行一次：

```bash
npm run db:seed
```

然后构建生产包：

```bash
npm run build
```

最后启动 PM2：

```bash
pm2 start ecosystem.config.cjs --env production
```

首次上线建议顺手执行：

```bash
pm2 save
```

如果你希望服务器重启后自动拉起，再执行：

```bash
pm2 startup
```

## 日常更新顺序

后续更新代码时，推荐顺序：

```bash
npm install
```

```bash
npm run db:deploy
```

```bash
npm run build
```

```bash
pm2 restart grudge-diary-backend
```

## 检查命令

```bash
pm2 status
```

```bash
pm2 logs grudge-diary-backend
```

```bash
pm2 describe grudge-diary-backend
```

## 说明

- `scripts/start-production.cjs` 会自动加载项目根目录下的 `.env`。
- `ecosystem.config.cjs` 默认监听 `0.0.0.0`，默认端口是 `4010`，也可以被 `.env` 里的 `PORT` 覆盖。
- 小程序本地开发当前默认指向 `http://127.0.0.1:4010`，正式发布时你需要把小程序请求地址改成你自己的线上域名。
