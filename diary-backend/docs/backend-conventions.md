# 后端分层与开发约定

本文件约束 `diary-backend` 的代码结构与写法，目标是**高可维护、可测试、稳定一致**。新增接口请遵循以下约定。

## 分层

```
app/api/**/route.ts   传输层：解析请求、鉴权（用包装器）、调用服务、序列化响应。不写业务逻辑。
lib/*-service.ts      领域/服务层：业务规则、事务、数据库读写。返回纯数据（已序列化）。
lib/prisma.ts         数据访问：单例 PrismaClient。
lib/*（其余）          可复用基础设施：校验、状态、日志、鉴权、限流、上传等纯工具。
```

**依赖方向**：`route` → `service` → `prisma`。基础设施模块（`validation` / `logger` / `diary-status` 等）可被任意层引用，但它们自身不依赖 `route`，避免循环依赖。

## 路由包装器（必须使用）

不要在每个 route 里手写鉴权和 try/catch。统一使用包装器：

- 小程序接口：`withDiaryUser(scope, failureMessage, handler)`（见 `lib/mp-route.ts`）
  - 自动校验登录态（401）、统一异常映射（`DiaryInputError`→400、`DiaryNotFoundError`→404、其余→记日志+500）。
  - `handler` 签名为 `(req, user) => Promise<Response>`，拿到的 `user` 已保证非空。
- 后台接口：`withAdmin(scope, handler)`（见 `lib/admin-route.ts`）
  - 自动鉴权（401）、已知 Prisma 错误翻译为友好提示（唯一约束/记录不存在/外键），其余记日志+500。

> Next 要求 `export const dynamic = "force-dynamic"` 等段配置仍写在各 route 文件顶部，包装器无法代劳。

新增小程序接口示例：

```ts
export const POST = withDiaryUser("diary/wechat/foo", "加载失败", async (req, user) => {
  const body = await readJsonBody(req);
  return mpOk(await doSomething(user.id, body));
});
```

## 输入校验

所有外部输入一律经过 `lib/validation.ts` 的原语清洗，**禁止**在 route/service 里重复手写：

- `asText` / `positiveInt` / `clampLevel` / `clampInt` / `parseDateInput` / `normalizeIdList`
- 列表分页统一用 `parsePagination(page, pageSize, { defaultPageSize, maxPageSize })`，强制单页上限以保护数据库。

条目状态相关一律用 `lib/diary-status.ts`：`normalizeStatus` / `normalizeStatusOrNull` / `isResolvedStatus` / `normalizeFollowUpType` / `RESOLVED_STATUSES` / `UNRESOLVED_STATUSES`。

## 日志

统一用 `lib/logger.ts` 的 `logError/logWarn/logInfo`，输出结构化 JSON 行（含 `scope`），便于采集。**不要**直接 `console.*`。错误详情只进日志，**绝不**回传给客户端（生产环境响应使用固定友好文案）。

## 响应格式

- 小程序：`{ code, data, msg }`，用 `lib/mp-api.ts` 的 `mpOk/mpErr/mpUnauthorized/mpServerError`。
- 后台：`{ code, message, data }`，用 `lib/admin-api-response.ts` 的 `adminJson`（自带禁缓存头）。

## 鉴权与安全

- 后台账号密码校验走 `lib/admin-auth.ts` 的恒定时间比较，避免时序泄漏。
- 后台令牌采用 **DB 会话**（`lib/admin-session.ts`）：登录签发 256-bit 不透明随机令牌，库内仅存其 SHA-256；支持过期（`ADMIN_SESSION_TTL_HOURS`，默认 7 天）与吊销（退出登录删除会话）。已废弃静态环境变量 `ADMIN_ACCESS_TOKEN`。
- 后台鉴权统一用 `withAdmin`（内部 `ensureAdmin` → `isAuthorizedAdminRequest`，按令牌哈希查库校验有效期）。新增后台接口无需自行处理令牌。
- 前端 401 由 `lib/admin-client-fetch.ts` 统一拦截：令牌失效自动登出并跳登录页。
- 登录类接口加 `lib/rate-limit.ts` 限流（当前单实例内存实现；多实例需换 Redis）。
- 上传仅接受位图，**拒绝 SVG**（XSS 载体），见 `lib/local-upload.ts`。
- 用户数据访问必须带 `userId` 条件，杜绝越权。

## 测试

纯函数（`validation` / `diary-status` / `rate-limit` / `admin-auth`）需有单元测试，放在 `__tests__/`。运行：

```
npm install
npm test
```
