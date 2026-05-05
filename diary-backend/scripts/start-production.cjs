/**
 * 生产环境启动入口：先加载项目根目录的 .env / .env.production，再启动 Next。
 * 这样无论 pm2 start npm、pm2 start ecosystem、还是直接 npm start，进程内都会有 ADMIN_*、DATABASE_URL 等变量，
 * 无需在 PM2 里手工同步每一份环境变量。
 */
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");

try {
  const { loadEnvConfig } = require("@next/env");
  // 第二参 false = 按 production 规则加载 .env.production / .env
  // 第四参 true = forceReload，避免进程里已有 __NEXT_PROCESSED_ENV 时跳过读 .env
  loadEnvConfig(root, false, console, true);
} catch (e) {
  console.warn("[start-production] loadEnvConfig:", e?.message ?? e);
}

// 便于排查：只表示「是否读到变量」，不是密码内容；避免写成 =ok 让人误以为密码是 ok
console.log(
  "[start-production] .env 超管变量:",
  process.env.ADMIN_USERNAME ? "已读取 ADMIN_USERNAME" : "缺少 ADMIN_USERNAME",
  process.env.ADMIN_PASSWORD ? "已读取 ADMIN_PASSWORD" : "缺少 ADMIN_PASSWORD",
);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const passthrough = process.argv.slice(2);
const nextArgs =
  passthrough.length > 0 ? passthrough : ["start", "-H", "0.0.0.0"];

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: root,
  env: { ...process.env },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
