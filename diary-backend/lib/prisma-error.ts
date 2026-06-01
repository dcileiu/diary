import { Prisma } from "@prisma/client";

export type FriendlyPrismaError = {
  /** 业务/HTTP 状态码 */
  status: number;
  message: string;
};

/**
 * 把常见的 Prisma 已知错误翻译成对用户友好的提示。
 * 未识别的错误返回 null，交由上层按 500 处理。
 */
export function mapPrismaError(error: unknown): FriendlyPrismaError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  switch (error.code) {
    case "P2002": {
      // 唯一约束冲突，例如分类/标签名重复。
      const target = error.meta?.target;
      const field = Array.isArray(target) ? target.join(", ") : String(target ?? "");
      return {
        status: 409,
        message: field ? `已存在重复的「${field}」` : "存在重复数据，无法保存",
      };
    }
    case "P2025":
      // 更新/删除时记录不存在。
      return { status: 404, message: "目标记录不存在或已被删除" };
    case "P2003":
      // 外键约束失败。
      return { status: 400, message: "关联数据不存在或仍被引用" };
    default:
      return null;
  }
}
