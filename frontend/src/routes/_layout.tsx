import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { LogOut } from "lucide-react"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { isLoggedIn, getAuthToken, clearAuthToken } from "@/contexts/AuthContext"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  const { logout, user, isLoading, status } = useAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground"
              title="退出登录"
            >
              <LogOut className="mr-2 size-4" />
              <span className="hidden sm:inline">退出登录</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
