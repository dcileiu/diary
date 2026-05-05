const path = require("path");

module.exports = {
  apps: [
    {
      name: "grudge-diary-backend",
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
