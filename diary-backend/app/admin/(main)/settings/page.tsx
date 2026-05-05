import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">系统信息</h1>
        <p className="text-muted-foreground text-sm">
          当前项目已经完成第一轮“壁纸模板 → 记仇日记系统”的结构性改造，这里保留为后续接配置项、内容审核和附件策略的入口。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前定位</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>前端：微信小程序，围绕首页概览、条目列表、详情与新增编辑。</p>
          <p>后端：Next.js Route Handlers + Prisma + MySQL。</p>
          <p>后台：概览、条目、分类、标签、用户五块主业务。</p>
          <p>下一步最适合补的是：附件上传、搜索优化、数据导出、内容审核标签。</p>
        </CardContent>
      </Card>
    </div>
  );
}
