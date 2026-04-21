import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Tag } from "lucide-react"
import { Suspense, useState } from "react"

import { CategoriesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddCategory from "@/components/Categories/AddCategory"
import { columns } from "@/components/Categories/columns"
import PendingCategories from "@/components/Pending/PendingCategories"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

function getCategoriesQueryOptions(type?: string) {
  return {
    queryFn: () => CategoriesService.readCategories({ type: type as any, limit: 100 }),
    queryKey: ["categories", type],
  }
}

export const Route = createFileRoute("/_layout/categories")({
  component: Categories,
  head: () => ({
    meta: [
      {
        title: "分类管理 - FastAPI Template",
      },
    ],
  }),
})

function CategoriesTableContent() {
  const [activeTab, setActiveTab] = useState<string>("all")

  const { data: categories } = useSuspenseQuery(
    getCategoriesQueryOptions(activeTab === "all" ? undefined : activeTab)
  )

  if (categories.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Tag className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">您还没有任何分类</h3>
        <p className="text-muted-foreground">添加一个新分类开始记账</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="income">收入</TabsTrigger>
          <TabsTrigger value="expense">支出</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable columns={columns} data={categories.data} />
    </div>
  )
}

function CategoriesTable() {
  return (
    <Suspense fallback={<PendingCategories />}>
      <CategoriesTableContent />
    </Suspense>
  )
}

function Categories() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">分类管理</h1>
          <p className="text-muted-foreground">管理您的收支分类标签</p>
        </div>
        <AddCategory />
      </div>
      <CategoriesTable />
    </div>
  )
}
