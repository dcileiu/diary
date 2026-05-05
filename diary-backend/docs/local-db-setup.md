# 本地数据库初始化

当前代码已经完成日记系统改造，但 `diary-backend/.env` 里的 MySQL 账号无法通过认证，所以数据库迁移和种子数据还没有实际落库。

## 1. 创建本地数据库

可以先在本机 MySQL 执行下面这段 SQL：

```sql
CREATE DATABASE IF NOT EXISTS grudge_diary
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'diary_user'@'127.0.0.1'
  IDENTIFIED BY 'change_me_123';

GRANT ALL PRIVILEGES ON grudge_diary.* TO 'diary_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 2. 更新 `.env`

把 `diary-backend/.env` 里的 `DATABASE_URL` 改成：

```env
DATABASE_URL="mysql://diary_user:change_me_123@127.0.0.1:3306/grudge_diary?charset=utf8mb4"
```

如果你想继续沿用现有数据库名，也可以只改账号密码，只要这条连接串能成功连上本机 MySQL 即可。

## 3. 落库和种子数据

在 `diary-backend` 目录执行：

```bash
npm run db:deploy
npm run db:seed
```

## 4. 启动后端

开发模式：

```bash
npm run dev
```

默认情况下，小程序当前会请求：

```text
http://127.0.0.1:3000
```

所以本地联调时直接跑开发服务器最省事。
