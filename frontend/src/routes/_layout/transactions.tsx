import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Wallet, Plus, Search, Filter } from "lucide-react"
import { Suspense, useState } from "react"

import { TransactionsService, CategoriesService } from "@/client"
import PendingTransactions from "@/components/Pending/PendingTransactions"
import AddTransaction from "@/components/Transactions/AddTransaction"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function getTransactionsQueryOptions(filters: {
  type?: string
  categoryId?: string
  startDate?: string
  endDate?: string
  search?: string
}) {
  return {
    queryFn: () =>
      TransactionsService.readTransactions({
        type: filters.type as any,
        categoryId: filters.categoryId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        search: filters.search,
        limit: 100,
      }),
    queryKey: [
      "transactions",
      filters.type,
      filters.categoryId,
      filters.startDate,
      filters.endDate,
      filters.search,
    ],
  }
}

function getSummaryQueryOptions() {
  return {
    queryFn: () => TransactionsService.getMonthlySummary({}),
    queryKey: ["transaction-summary"],
  }
}

export const Route = createFileRoute("/_layout/transactions")({
  component: Transactions,
  head: () => ({
    meta: [
      {
        title: "交易记录 - FastAPI Template",
      },
    ],
  }),
})

function SummaryCards() {
  const { data: summary } = useSuspenseQuery(getSummaryQueryOptions())

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>本月收入</CardDescription>
          <CardTitle className="text-2xl text-green-500">
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
          <CardTitle className="text-2xl text-red-500">
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

function TransactionItem({ transaction }: { transaction: any }) {
  const isIncome = transaction.type === "income"

  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: transaction.category_color
              ? `${transaction.category_color}20`
              : "hsl(var(--muted))",
          }}
        >
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: transaction.category_color || "hsl(var(--muted-foreground))",
            }}
          />
        </div>
        <div>
          <p className="font-medium">{transaction.category_name}</p>
          <p className="text-sm text-muted-foreground">
            {transaction.description || "无备注"} ·{" "}
            {transaction.transaction_date}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-semibold",
            isIncome ? "text-green-500" : "text-red-500"
          )}
        >
          {isIncome ? "+" : "-"}¥{transaction.amount.toFixed(2)}
        </p>
        <Badge variant={isIncome ? "default" : "destructive"}>
          {isIncome ? "收入" : "支出"}
        </Badge>
      </div>
    </div>
  )
}

function TransactionsList() {
  const [activeTab, setActiveTab] = useState<string>("all")
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => CategoriesService.readCategories({ limit: 100 }),
  })

  const { data: transactions } = useSuspenseQuery(
    getTransactionsQueryOptions({
      type: activeTab === "all" ? undefined : activeTab,
      categoryId: selectedCategory === "all" ? undefined : selectedCategory,
      search: appliedSearch || undefined,
    })
  )

  const handleSearch = () => {
    setAppliedSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  if (transactions.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">暂无交易记录</h3>
        <p className="text-muted-foreground">点击"记一笔"开始记录您的收支</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="income">收入</TabsTrigger>
            <TabsTrigger value="expense">支出</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索交易..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} variant="secondary" size="sm">
            搜索
          </Button>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories?.data?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AddTransaction />
      </div>

      <Card>
        <CardContent className="pt-6">
          {transactions.data.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionsTable() {
  return (
    <Suspense fallback={<PendingTransactions />}>
      <TransactionsList />
    </Suspense>
  )
}

function Transactions() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">交易记录</h1>
          <p className="text-muted-foreground">查看和管理您的收支流水</p>
        </div>
        <AddTransaction />
      </div>

      <Suspense fallback={null}>
        <SummaryCards />
      </Suspense>

      <TransactionsTable />
    </div>
  )
}
