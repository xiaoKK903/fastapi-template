import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useState } from "react"
import { TrendingUp, TrendingDown, PieChart as PieChartIcon } from "lucide-react"

import { TransactionsService } from "@/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function getTrendQueryOptions(days: number = 30) {
  return {
    queryFn: () => TransactionsService.getDailyTrend({ days }),
    queryKey: ["transaction-trend", days],
  }
}

function getCategorySummaryQueryOptions(year: number, month: number) {
  return {
    queryFn: () => TransactionsService.getCategoryMonthlySummary({ year, month }),
    queryKey: ["transaction-category-summary", year, month],
  }
}

function getYearlySummaryQueryOptions(year: number) {
  return {
    queryFn: () => TransactionsService.getYearlySummary({ year }),
    queryKey: ["transaction-yearly-summary", year],
  }
}

function getMonthlySummaryQueryOptions(year: number, month: number) {
  return {
    queryFn: () => TransactionsService.getMonthlySummary({ year, month }),
    queryKey: ["transaction-monthly-summary", year, month],
  }
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
]

export const Route = createFileRoute("/_layout/finance-stats")({
  component: FinanceStats,
  head: () => ({
    meta: [
      {
        title: "财务统计 - FastAPI Template",
      },
    ],
  }),
})

function SummaryCards() {
  const today = new Date()
  const { data: summary } = useSuspenseQuery(
    getMonthlySummaryQueryOptions(today.getFullYear(), today.getMonth() + 1)
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本月收入</CardDescription>
          <CardTitle className="text-2xl text-green-500 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            +¥{summary.total_income.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">共 {summary.income_count} 笔</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本月支出</CardDescription>
          <CardTitle className="text-2xl text-red-500 flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            -¥{summary.total_expense.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">共 {summary.expense_count} 笔</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本月结余</CardDescription>
          <CardTitle
            className={cn(
              "text-2xl",
              summary.balance >= 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {summary.balance >= 0 ? "+" : ""}¥{summary.balance.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            收入 - 支出
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本月交易</CardDescription>
          <CardTitle className="text-2xl">
            {summary.income_count + summary.expense_count}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">笔数总计</p>
        </CardContent>
      </Card>
    </div>
  )
}

function TrendChart() {
  const [days, setDays] = useState(30)
  const { data: trend } = useSuspenseQuery(getTrendQueryOptions(days))

  const chartData = trend.days.map((day: any) => ({
    name: day.date.slice(5),
    收入: day.income,
    支出: day.expense,
    结余: day.balance,
  }))

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>收支趋势</CardTitle>
            <CardDescription>查看最近 {days} 天的收支情况</CardDescription>
          </div>
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7天</SelectItem>
              <SelectItem value="14">14天</SelectItem>
              <SelectItem value="30">30天</SelectItem>
              <SelectItem value="90">90天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `¥${value.toFixed(2)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="收入"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="支出"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="结余"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryPieCharts() {
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  const { data: categorySummary } = useSuspenseQuery(
    getCategorySummaryQueryOptions(selectedYear, selectedMonth)
  )

  const incomeData = categorySummary.income_categories.map((cat: any, index: number) => ({
    name: cat.category_name,
    value: cat.total_amount,
    percentage: cat.percentage,
    color: COLORS[index % COLORS.length],
  }))

  const expenseData = categorySummary.expense_categories.map((cat: any, index: number) => ({
    name: cat.category_name,
    value: cat.total_amount,
    percentage: cat.percentage,
    color: COLORS[index % COLORS.length],
  }))

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>分类统计</CardTitle>
            <CardDescription>按分类查看收支占比</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {m}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="expense">
          <TabsList className="mb-4">
            <TabsTrigger value="expense">支出分类</TabsTrigger>
            <TabsTrigger value="income">收入分类</TabsTrigger>
          </TabsList>
          <TabsContent value="expense">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="h-64">
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percentage }) =>
                          `${name} ${percentage}%`
                        }
                      >
                        {expenseData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `¥${value.toFixed(2)}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暂无支出数据
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {expenseData.map((item: any) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">¥{item.value.toFixed(2)}</span>
                      <Badge variant="secondary" className="ml-2">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="income">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="h-64">
                {incomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percentage }) =>
                          `${name} ${percentage}%`
                        }
                      >
                        {incomeData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `¥${value.toFixed(2)}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暂无收入数据
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {incomeData.map((item: any) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">¥{item.value.toFixed(2)}</span>
                      <Badge variant="secondary" className="ml-2">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function YearlySummary() {
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())

  const { data: yearlySummary } = useSuspenseQuery(
    getYearlySummaryQueryOptions(selectedYear)
  )

  const monthlyData = yearlySummary.monthly_breakdown.map((item: any) => ({
    name: `${item.month}月`,
    收入: item.income,
    支出: item.expense,
    结余: item.balance,
  }))

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>年度汇总</CardTitle>
            <CardDescription>
              {selectedYear}年总收入 ¥{yearlySummary.total_income.toFixed(2)}，总支出 ¥{yearlySummary.total_expense.toFixed(2)}，结余 ¥{yearlySummary.balance.toFixed(2)}
            </CardDescription>
          </div>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => `¥${value.toFixed(2)}`}
              />
              <Legend />
              <Bar dataKey="收入" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="结余" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function FinanceStats() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">财务统计</h1>
        <p className="text-muted-foreground">查看您的收支数据统计和趋势</p>
      </div>

      <SummaryCards />

      <div className="grid gap-4">
        <TrendChart />
        <CategoryPieCharts />
        <YearlySummary />
      </div>
    </div>
  )
}
