import { Prisma } from "@prisma/client";
import { mpErrorMessage } from "@/lib/mp-api";

function prismaKnownRequestHint(e: Prisma.PrismaClientKnownRequestError): string | null {
  if (e.code === "P2022") {
    return process.env.NODE_ENV === "development"
      ? `数据库缺列或类型不匹配: ${mpErrorMessage(e)}，请执行 npx prisma migrate deploy`
      : "数据库表结构需更新（请部署迁移）。空表不会报错，此为连接或缺列等问题。";
  }
  if (e.code === "P2021" || e.code === "P2010") {
    return process.env.NODE_ENV === "development"
      ? `数据库缺表: ${mpErrorMessage(e)}，请执行 npx prisma migrate deploy`
      : "数据库表未就绪，请在服务器执行 prisma migrate deploy";
  }
  if (e.code === "P1001" || e.code === "P1003" || e.code === "P1017") {
    return process.env.NODE_ENV === "development"
      ? `数据库不可达: ${mpErrorMessage(e)}`
      : "无法连接数据库，请检查 DATABASE_URL 与 MySQL 是否可用";
  }
  return null;
}

/**
 * 小程序壁纸类接口 catch：空数据不会抛错，进 catch 多为连接/结构异常。
 */
export function wallpaperWechatApiErrorMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const h = prismaKnownRequestHint(e);
    if (h) return h;
  }
  return process.env.NODE_ENV === "development"
    ? `服务器错误: ${mpErrorMessage(e)}`
    : "服务暂不可用（不是「暂无壁纸」）。多为数据库未连接或未完成迁移，请查看服务器日志。";
}

/** 管理端壁纸存储相关接口 catch 文案（与小程序语义一致，措辞偏后台） */
export function wallpaperAdminStoreErrorMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const h = prismaKnownRequestHint(e);
    if (h) return h;
  }
  return process.env.NODE_ENV === "development"
    ? `服务器错误: ${mpErrorMessage(e)}`
    : "读取或保存壁纸记录失败。请检查数据库连接，并在服务器执行 npx prisma migrate deploy。";
}
