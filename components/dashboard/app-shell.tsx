import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Topbar } from "./topbar";
import { ToastProvider } from "./toast-provider";
import { AssistantLauncher } from "./assistant/assistant-launcher";

interface AppShellProps {
  userName: string;
  userRole: string;
  children: ReactNode;
}

export function AppShell({ userName, userRole, children }: AppShellProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Topbar userName={userName} userRole={userRole} />
          <main className="flex-1 px-4 py-4 pb-20 md:pb-4 lg:px-8 lg:py-6">{children}</main>
        </div>
        <BottomNav />
        <AssistantLauncher />
      </div>
    </ToastProvider>
  );
}
