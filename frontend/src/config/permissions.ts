export interface MenuPermission {
  path: string
  title: string
  requiredRole?: string
  requiredPermission?: string
  isSuperuserOnly?: boolean
}

export const menuPermissions: MenuPermission[] = [
  {
    path: "/",
    title: "Dashboard",
    requiredRole: "user",
  },
  {
    path: "/items",
    title: "Items",
    requiredRole: "user",
  },
  {
    path: "/habits",
    title: "习惯管理",
    requiredRole: "user",
  },
  {
    path: "/habit-calendar",
    title: "打卡日历",
    requiredRole: "user",
  },
  {
    path: "/habit-stats",
    title: "习惯统计",
    requiredRole: "user",
  },
  {
    path: "/transactions",
    title: "交易记录",
    requiredRole: "user",
  },
  {
    path: "/categories",
    title: "分类管理",
    requiredRole: "user",
  },
  {
    path: "/budgets",
    title: "预算管理",
    requiredRole: "user",
  },
  {
    path: "/finance-stats",
    title: "财务统计",
    requiredRole: "user",
  },
  {
    path: "/admin",
    title: "Admin",
    isSuperuserOnly: true,
  },
]

export const BuiltinRoles = {
  ADMIN: "admin",
  USER: "user",
  GUEST: "guest",
} as const

export type BuiltinRole = (typeof BuiltinRoles)[keyof typeof BuiltinRoles]

export const roleHierarchy: Record<string, string[]> = {
  [BuiltinRoles.ADMIN]: [BuiltinRoles.ADMIN, BuiltinRoles.USER, BuiltinRoles.GUEST],
  [BuiltinRoles.USER]: [BuiltinRoles.USER, BuiltinRoles.GUEST],
  [BuiltinRoles.GUEST]: [BuiltinRoles.GUEST],
}

export function hasRequiredRole(
  userRoles: string[],
  requiredRole: string
): boolean {
  for (const role of userRoles) {
    const inheritedRoles = roleHierarchy[role] || [role]
    if (inheritedRoles.includes(requiredRole)) {
      return true
    }
  }
  return false
}

export function canAccessMenu(
  menu: MenuPermission,
  isSuperuser: boolean,
  userRoles: string[]
): boolean {
  if (menu.isSuperuserOnly) {
    return isSuperuser
  }

  if (menu.requiredRole) {
    return hasRequiredRole(userRoles, menu.requiredRole)
  }

  return true
}

export function filterAccessibleMenus(
  menus: MenuPermission[],
  isSuperuser: boolean,
  userRoles: string[]
): MenuPermission[] {
  return menus.filter((menu) => canAccessMenu(menu, isSuperuser, userRoles))
}
