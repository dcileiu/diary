function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === "") return undefined;
  return v.trim();
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function allowMemoryStoreFallback(): boolean {
  return !isProductionRuntime();
}

export function missingCriticalConfigKeys(): string[] {
  const required = [
    "DATABASE_URL",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "ADMIN_ACCESS_TOKEN",
    "WECHAT_MINI_PROGRAM_APP_ID",
    "WECHAT_MINI_PROGRAM_SECRET",
  ];
  return required.filter((key) => !readEnv(key));
}

export function missingDatabaseConfig(): boolean {
  return !readEnv("DATABASE_URL");
}
