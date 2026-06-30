# 本地数据库初始化

后端使用 **SQLite**，无需单独安装数据库服务，数据库就是一个文件。

## 1. 配置 `.env`

复制示例并确认 `DATABASE_URL`：

```bash
cp .env.example .env
```

```env
# 路径相对于 prisma/schema.prisma 所在目录，实际指向 diary-backend/db/dev.db
DATABASE_URL="file:../db/dev.db"
```

无需创建数据库或账号——首次执行迁移时会在 `db/` 目录自动生成数据库文件。

## 2. 落库和种子数据

在 `diary-backend` 目录执行：

```bash
npm run db:deploy
npm run db:seed
```

## 3. 启动后端

开发模式：

```bash
npm run dev
```

默认情况下，小程序当前会请求：

```text
http://127.0.0.1:4010
```

所以本地联调时直接跑开发服务器最省事。
