import type { Row } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import type { CategoryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteCategory from "./DeleteCategory"
import EditCategory from "./EditCategory"

interface CategoryActionsMenuProps {
  category: CategoryPublic
}

export function CategoryActionsMenu({ category }: CategoryActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">打开菜单</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="p-0">
          <EditCategory category={category} />
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="p-0">
          <DeleteCategory category={category} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DataTableCategoryActions<
  TData extends { id: string; name: string },
>({ row }: { row: Row<TData> }) {
  return (
    <CategoryActionsMenu category={row.original as unknown as CategoryPublic} />
  )
}
