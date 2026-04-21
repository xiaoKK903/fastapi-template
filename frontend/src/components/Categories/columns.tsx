import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import type { CategoryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils"
import { CategoryActionsMenu } from "./CategoryActionsMenu"
import { Badge } from "@/components/ui/badge"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    income: "收入",
    expense: "支出",
  }
  return labels[type] || type
}

function getTypeVariant(type: string) {
  return type === "income" ? "default" : "destructive"
}

function getTypeColor(type: string) {
  return type === "income" ? "text-green-500" : "text-red-500"
}

export const columns: ColumnDef<CategoryPublic>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "name",
    header: "分类名称",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {row.original.color && (
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
        )}
        <span className="font-medium">{row.original.name}</span>
        {row.original.icon && (
          <span className="text-xs text-muted-foreground">({row.original.icon})</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "类型",
    cell: ({ row }) => (
      <Badge variant={getTypeVariant(row.original.type) as any}>
        {getTypeLabel(row.original.type)}
      </Badge>
    ),
  },
  {
    accessorKey: "description",
    header: "描述",
    cell: ({ row }) => {
      const description = row.original.description
      return (
        <span
          className={cn(
            "max-w-xs truncate block text-muted-foreground",
            !description && "italic",
          )}
        >
          {description || "无描述"}
        </span>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <CategoryActionsMenu category={row.original} />
      </div>
    ),
  },
]
