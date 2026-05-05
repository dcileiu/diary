import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          系统设置
        </h1>
        <p className="text-muted-foreground text-sm">
          示例表单布局，后续接环境变量或服务端配置。
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">站点信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">站点名称</Label>
            <Input
              id="site-name"
              className="min-h-11 text-base sm:min-h-9 sm:text-sm"
              placeholder="壁纸小程序"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-base">API 根路径（占位）</Label>
            <Input
              id="api-base"
              className="min-h-11 text-base sm:min-h-9 sm:text-sm"
              placeholder="/api"
              disabled
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
