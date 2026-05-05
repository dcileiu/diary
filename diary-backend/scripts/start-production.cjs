const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");

try {
  const { loadEnvConfig } = require("@next/env");
  loadEnvConfig(root, false, console, true);
} catch (error) {
  console.warn("[start-production] loadEnvConfig:", error?.message ?? error);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const passthrough = process.argv.slice(2);
const nextArgs = passthrough.length > 0 ? passthrough : ["start", "-H", "0.0.0.0"];

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: root,
  env: { ...process.env },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
