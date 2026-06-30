const path = require("path");

module.exports = {
  apps: [
    {
      name: "diary-backend",
      cwd: __dirname,
      script: path.join(__dirname, "scripts", "start-production.cjs"),
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "4010",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "4010",
      },
    },
  ],
};
