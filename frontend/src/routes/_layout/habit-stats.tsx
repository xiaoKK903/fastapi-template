import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import { Suspense } from "react"
import {
  Calendar,
  Target,
  Flame,
  Trophy,
  TrendingUp,
} from "lucide-react"

import {
  HabitRecordsService,
  type HabitStatistics,
  type HabitTrend,
} from "@/client/habitRecords"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/_layout/habit-stats")({
  component: HabitStatsPage,
  head: () => ({
    meta: [
      {
        title: "数据统计 - FastAPI Template",
      },
    ],
  }),
})

function getStatisticsQueryOptions() {
  return {
    queryFn: () => HabitRecordsService.getHabitStatistics(),
    queryKey: ["habit-statistics"],
  }
}

function getTrendQueryOptions(days: number = 30) {
  return {
    queryFn: () => HabitRecordsService.getHabitTrend({ days }),
    queryKey: ["habit-trend", days],
  }
}

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
]

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType
  title: string
  value: string | number
  subtitle?: string
  color: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HabitStatsContent() {
  const { data: statistics, isLoading: isStatsLoading } = useQuery(
    getStatisticsQueryOptions()
  )
  const { data: trend30, isLoading: isTrend30Loading } = useQuery(
    getTrendQueryOptions(30)
  )
  const { data: trend7, isLoading: isTrend7Loading } = useQuery(
    getTrendQueryOptions(7)
  )

  const isLoading = isStatsLoading || isTrend30Loading || isTrend7Loading

  if (isLoading) {
    return <LoadingSkeleton />
  }

  const trendData = trend30?.days || []
  const trendData7 = trend7?.days || []

  const completionByDay = trendData.reduce((acc, day) => {
    const weekDay = new Date(day.date).getDay()
    if (!acc[weekDay]) {
      acc[weekDay] = { total: 0, completed: 0, count: 0 }
    }
    acc[weekDay].total += day.total_habits
    acc[weekDay].completed += day.completed_count
    acc[weekDay].count += 1
    return acc
  }, {} as Record<number, { total: number; completed: number; count: number }>)

  const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"]
  const weekDayData = weekDayNames.map((name, index) => {
    const data = completionByDay[index] || { total: 0, completed: 0, count: 0 }
    const avgTotal = data.count > 0 ? data.total / data.count : 0
    const avgCompleted = data.count > 0 ? data.completed / data.count : 0
    return {
      name: `周${name}`,
      total: Math.round(avgTotal),
      completed: Math.round(avgCompleted),
      rate: avgTotal > 0 ? Math.round((avgCompleted / avgTotal) * 100) : 0,
    }
  })

  const monthlyCompletionRate = trendData.length > 0
    ? Math.round((trendData.filter(d => d.completed_count > 0).length / trendData.length) * 100)
    : 0

  const pieData = [
    { name: "完成天数", value: trendData.filter(d => d.completed_count > 0).length },
    { name: "未完成天数", value: trendData.filter(d => d.completed_count === 0).length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据统计</h1>
        <p className="text-muted-foreground">查看您的打卡数据统计和趋势</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Target}
          title="总习惯数"
          value={statistics?.total_habits || 0}
          color="text-blue-500"
        />
        <StatCard
          icon={Calendar}
          title="近30天打卡"
          value={statistics?.total_checks_last_30_days || 0}
          subtitle="次"
          color="text-green-500"
        />
        <StatCard
          icon={TrendingUp}
          title="日均打卡"
          value={(statistics?.average_checks_per_day || 0).toFixed(1)}
          color="text-purple-500"
        />
        <StatCard
          icon={Flame}
          title="连续打卡"
          value={statistics?.streak_days || 0}
          subtitle="天"
          color="text-orange-500"
        />
        <StatCard
          icon={Trophy}
          title="月度打卡率"
          value={`${monthlyCompletionRate}%`}
          color="text-emerald-500"
        />
      </div>

      <Tabs defaultValue="trend" className="w-full">
        <TabsList>
          <TabsTrigger value="trend">打卡趋势</TabsTrigger>
          <TabsTrigger value="weekday">周度分析</TabsTrigger>
          <TabsTrigger value="overview">数据概览</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>近30天打卡趋势</CardTitle>
              <p className="text-sm text-muted-foreground">
                展示您最近30天的习惯完成情况
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => {
                        const d = new Date(date)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                      tick={{ fontSize: 12 }}
                      interval={Math.floor(trendData.length / 6)}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("zh-CN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total_habits"
                      name="总习惯数"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed_count"
                      name="已完成"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>近7天打卡趋势</CardTitle>
              <p className="text-sm text-muted-foreground">
                展示您最近一周的习惯完成情况
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trendData7}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => {
                        const d = new Date(date)
                        const weekDays = ["日", "一", "二", "三", "四", "五", "六"]
                        return `周${weekDays[d.getDay()]}`
                      }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("zh-CN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "long",
                        })
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="total_habits"
                      name="总习惯数"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="completed_count"
                      name="已完成"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekday" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>周度完成分析</CardTitle>
              <p className="text-sm text-muted-foreground">
                分析您在不同星期几的习惯完成情况
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weekDayData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value, name) => {
                        if (name === "rate") {
                          return [`${value}%`, "完成率"]
                        }
                        return [value, name === "total" ? "总习惯数" : "已完成"]
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="total"
                      name="总习惯数"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="completed"
                      name="已完成"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>周度完成率</CardTitle>
              <p className="text-sm text-muted-foreground">
                各星期几的平均完成率
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weekDayData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      formatter={(value) => [`${value}%`, "完成率"]}
                    />
                    <Bar
                      dataKey="rate"
                      name="完成率"
                      radius={[4, 4, 0, 0]}
                    >
                      {weekDayData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>本月完成情况</CardTitle>
                <p className="text-sm text-muted-foreground">
                  近30天打卡天数统计
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#10b981" : "#ef4444"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>关键指标</CardTitle>
                <p className="text-sm text-muted-foreground">
                  您的打卡核心数据
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">总习惯数</p>
                      <p className="text-2xl font-bold">{statistics?.total_habits || 0}</p>
                    </div>
                    <Badge variant="outline">习惯管理</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">近30天打卡次数</p>
                      <p className="text-2xl font-bold">{statistics?.total_checks_last_30_days || 0}</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                      打卡记录
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">日均打卡</p>
                      <p className="text-2xl font-bold">{(statistics?.average_checks_per_day || 0).toFixed(1)}</p>
                    </div>
                    <Badge variant="outline">平均值</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">连续打卡天数</p>
                      <p className="text-2xl font-bold text-orange-600">{statistics?.streak_days || 0}</p>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800">
                      🔥 连续
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">月度打卡率</p>
                      <p className="text-2xl font-bold text-emerald-600">{monthlyCompletionRate}%</p>
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                      完成率
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HabitStatsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HabitStatsContent />
    </Suspense>
  )
}
