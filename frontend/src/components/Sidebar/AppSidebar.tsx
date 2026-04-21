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
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Dashboard", path: "/" },
  { icon: Briefcase, title: "Items", path: "/items" },
  { icon: Target, title: "习惯管理", path: "/habits" },
  { icon: CalendarIcon, title: "打卡日历", path: "/habit-calendar" },
  { icon: BarChart3, title: "习惯统计", path: "/habit-stats" },
  { icon: Wallet, title: "交易记录", path: "/transactions" },
  { icon: Tag, title: "分类管理", path: "/categories" },
  { icon: PieChart, title: "预算管理", path: "/budgets" },
  { icon: BarChart3, title: "财务统计", path: "/finance-stats" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Admin", path: "/admin" }]
    : baseItems

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
