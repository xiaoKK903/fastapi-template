import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { CheckinsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddHabit from "@/components/Habits/AddHabit"
import { columns } from "@/components/Habits/columns"
import PendingHabits from "@/components/Pending/PendingHabits"

function getHabitsQueryOptions() {
  return {
    queryFn: () => CheckinsService.getHabitsWithStats({ skip: 0, limit: 100 }),
    queryKey: ["habits"],
  }
}

export const Route = createFileRoute("/_layout/habits")({
  component: Habits,
  head: () => ({
    meta: [
      {
        title: "习惯管理 - FastAPI Template",
      },
    ],
  }),
})

function HabitsTableContent() {
  const { data: habits } = useSuspenseQuery(getHabitsQueryOptions())

  if (habits.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">您还没有任何习惯</h3>
        <p className="text-muted-foreground">添加一个新习惯开始您的打卡之旅</p>
      </div>
    )
  }

  return <DataTable columns={columns} data={habits.data} />
}

function HabitsTable() {
  return (
    <Suspense fallback={<PendingHabits />}>
      <HabitsTableContent />
    </Suspense>
  )
}

function Habits() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">习惯管理</h1>
          <p className="text-muted-foreground">创建和管理您的习惯打卡</p>
        </div>
        <AddHabit />
      </div>
      <HabitsTable />
    </div>
  )
}
