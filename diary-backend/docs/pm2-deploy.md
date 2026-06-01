# PM2 部署说明

这套后端推荐部署方式：

- 应用：`PM2 + Next.js`
- 数据库：`MySQL 8.0`
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

## 首次上线命令顺序

在 `diary-backend` 目录执行：

```bash
npm install
```

```bash
cp .env.example .env
```

编辑 `.env`，填好生产环境配置。

确认 MySQL 数据库和账号已经存在后，执行：

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
