"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-token";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground text-sm">
        验证登录…
      </div>
    );
  }
  return <>{children}</>;
}
