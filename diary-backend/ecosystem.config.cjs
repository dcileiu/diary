/**
 * 宝塔 / PM2：在 wallpaper-backend 目录执行
 *   pm2 start ecosystem.config.cjs
 *
 * 实际进程由 scripts/start-production.cjs 拉起：会先 loadEnvConfig 读项目根 .env，
 * 再启动 Next，迁移服务器时只要带上 .env（或同目录重建），不必在 PM2 里重复配 ADMIN_* 等变量。
 * 修改 .env 后：pm2 restart wallpaper-backend
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "wallpaper-backend",
      cwd: __dirname,
      script: path.join(__dirname, "scripts", "start-production.cjs"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3010",
      },
    },
  ],
};
