import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Award, BarChart3, Calendar, Flame, Trophy } from "lucide-react"
import { Suspense } from "react"

import { CheckinsService } from "@/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

function getDashboardQueryOptions() {
  return {
    queryFn: () => CheckinsService.getDashboardStats(),
    queryKey: ["dashboard"],
  }
}

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - FastAPI Template",
      },
    ],
  }),
})

function SimpleProgress({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <div className={cn("h-3 rounded-full overflow-hidden bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value)) + "%" }}
      />
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  colorClass,
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  colorClass?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn("rounded-full p-2", colorClass || "bg-muted")}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

function HabitProgressCard({
  rank,
  habit,
}: {
  rank: number
  habit: {
    habit_id: string
    habit_name: string
    total_checkins: number
    current_streak: number
    longest_streak: number
    completion_rate: number
  }
}) {
  let colorClass = "text-muted-foreground"
  let bgClass = "bg-muted"
  if (habit.completion_rate >= 80) {
    colorClass = "text-green-600"
    bgClass = "bg-green-100"
  } else if (habit.completion_rate >= 50) {
    colorClass = "text-yellow-600"
    bgClass = "bg-yellow-100"
  } else if (habit.completion_rate > 0) {
    colorClass = "text-orange-600"
    bgClass = "bg-orange-100"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
              rank === 1 ? "bg-yellow-100 text-yellow-700" :
              rank === 2 ? "bg-gray-200 text-gray-700" :
              rank === 3 ? "bg-orange-100 text-orange-700" :
              "bg-muted text-muted-foreground"
            )}
          >
            {rank}
          </div>
          <div>
            <p className="font-medium">{habit.habit_name}</p>
            <p className="text-xs text-muted-foreground">
              总打卡 {habit.total_checkins} 次 · 连续 {habit.current_streak} 天
            </p>
          </div>
        </div>
        <div className={cn("font-bold", colorClass)}>
          {habit.completion_rate.toFixed(1)}%
        </div>
      </div>
      <SimpleProgress value={habit.completion_rate} className={bgClass} />
    </div>
  )
}

function DashboardContent() {
  const { user: currentUser } = useAuth()
  const { data: stats } = useSuspenseQuery(getDashboardQueryOptions())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl truncate max-w-sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          欢迎回来，今天坚持打卡了吗？
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="本周打卡"
          value={stats.weekly.total_checkins}
          description={`${stats.weekly.habits_with_checkins} 个习惯有打卡`}
          icon={Calendar}
          colorClass="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="本月打卡"
          value={stats.monthly.total_checkins}
          description={`${stats.monthly.habits_with_checkins} 个习惯有打卡`}
          icon={BarChart3}
          colorClass="bg-purple-100 text-purple-700"
        />
        <StatCard
          title="最长连续打卡"
          value={`${stats.longest_streak} 天`}
          description={stats.longest_streak_habit_name || "暂无记录"}
          icon={Trophy}
          colorClass="bg-yellow-100 text-yellow-700"
        />
        <StatCard
          title="总习惯数"
          value={stats.total_habits}
          description="继续保持，养成更多好习惯！"
          icon={Award}
          colorClass="bg-green-100 text-green-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-5 text-orange-500" />
              完成率排行榜
            </CardTitle>
            <CardDescription>按完成率排序的习惯</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_habits.length > 0 ? (
              <div className="space-y-6">
                {stats.top_habits.map((habit, index) => (
                  <HabitProgressCard key={habit.habit_id} rank={index + 1} habit={habit} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                您还没有任何习惯数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-blue-500" />
              快速统计
            </CardTitle>
            <CardDescription>本周和本月的完成情况</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">本周完成率</span>
                <span className="font-bold">{stats.weekly.completion_rate.toFixed(1)}%</span>
              </div>
              <SimpleProgress
                value={stats.weekly.completion_rate}
                className="h-3 bg-blue-100"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">本月完成率</span>
                <span className="font-bold">{stats.monthly.completion_rate.toFixed(1)}%</span>
              </div>
              <SimpleProgress
                value={stats.monthly.completion_rate}
                className="h-3 bg-purple-100"
              />
            </div>

            <div className="rounded-lg bg-muted p-4 mt-4">
              <p className="text-sm text-muted-foreground mb-2">💡 小贴士</p>
              <p className="text-sm">
                {stats.longest_streak > 0
                  ? `太棒了！您已经连续打卡 ${stats.longest_streak} 天，继续保持！`
                  : "开始您的第一个习惯打卡吧，坚持21天就能养成习惯！"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
