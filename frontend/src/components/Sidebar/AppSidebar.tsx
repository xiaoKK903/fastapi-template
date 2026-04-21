import {
  Briefcase,
  Home,
  Target,
  Users,
  Calendar as CalendarIcon,
  BarChart3,
  Wallet,
  PieChart,
  Tag,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"
import { BuiltinRoles, canAccessMenu, type MenuPermission } from "@/config/permissions"

interface MenuConfig extends MenuPermission, Item {}

const menuConfigs: MenuConfig[] = [
  { icon: Home, title: "Dashboard", path: "/", requiredRole: BuiltinRoles.USER },
  { icon: Briefcase, title: "Items", path: "/items", requiredRole: BuiltinRoles.USER },
  { icon: Target, title: "习惯管理", path: "/habits", requiredRole: BuiltinRoles.USER },
  { icon: CalendarIcon, title: "打卡日历", path: "/habit-calendar", requiredRole: BuiltinRoles.USER },
  { icon: BarChart3, title: "习惯统计", path: "/habit-stats", requiredRole: BuiltinRoles.USER },
  { icon: Wallet, title: "交易记录", path: "/transactions", requiredRole: BuiltinRoles.USER },
  { icon: Tag, title: "分类管理", path: "/categories", requiredRole: BuiltinRoles.USER },
  { icon: PieChart, title: "预算管理", path: "/budgets", requiredRole: BuiltinRoles.USER },
  { icon: BarChart3, title: "财务统计", path: "/finance-stats", requiredRole: BuiltinRoles.USER },
  { icon: Users, title: "Admin", path: "/admin", isSuperuserOnly: true },
]

export function AppSidebar() {
  const { user: currentUser, getUserRoles, isSuperuser } = useAuth()

  const loggedIn = isLoggedIn()
  const userIsSuperuser = isSuperuser()
  const userRoles = getUserRoles()

  // 过滤可访问的菜单
  const accessibleMenus = menuConfigs.filter((menu) => {
    if (!loggedIn) return false
    return canAccessMenu(menu, userIsSuperuser, userRoles)
  })

  const items: Item[] = accessibleMenus.map((menu) => ({
    icon: menu.icon,
    title: menu.title,
    path: menu.path,
  }))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
