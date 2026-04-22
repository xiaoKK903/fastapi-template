import { zodResolver } from "@hookform/resolvers/zod"
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, PieChart, Plus, XCircle } from "lucide-react"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { BudgetsService, CategoriesService } from "@/client"
import PendingBudgets from "@/components/Pending/PendingBudgets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: "预算金额必须大于0" }),
  category_id: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
})

type FormData = z.infer<typeof formSchema>

function getBudgetsQueryOptions(year: number, month: number) {
  return {
    queryFn: () => BudgetsService.readBudgets({ year, month }),
    queryKey: ["budgets", year, month],
  }
}

function getOverbudgetQueryOptions(year: number, month: number) {
  return {
    queryFn: () => BudgetsService.checkOverbudget({ year, month }),
    queryKey: ["budgets-overbudget", year, month],
  }
}

export const Route = createFileRoute("/_layout/budgets")({
  component: Budgets,
  head: () => ({
    meta: [
      {
        title: "预算管理 - FastAPI Template",
      },
    ],
  }),
})

function AddBudget() {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const today = new Date()

  const { data: categories } = useQuery({
    queryKey: ["categories", "expense"],
    queryFn: () =>
      CategoriesService.readCategories({ type: "expense" as any, limit: 100 }),
    enabled: isOpen,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      category_id: "total",
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    },
  })

  const mutation = useMutation({
    mutationFn: (data: any) =>
      BudgetsService.createBudget({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("预算创建成功")
      form.reset()
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      category_id: data.category_id === "total" ? null : data.category_id,
      amount: Number(data.amount),
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          添加预算
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加预算</DialogTitle>
          <DialogDescription>设置您的月度支出预算。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年份</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={2020}
                          max={2100}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10) || 2026)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>月份</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <SelectItem key={m} value={m.toString()}>
                              {m}月
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类（可选，留空为总预算）</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="总预算（不指定分类）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="total">总预算</SelectItem>
                        {categories?.data?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>预算金额</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ¥
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  取消
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                保存
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function BudgetCard({ budget }: { budget: any }) {
  const isOverBudget = budget.remaining < 0
  const isNearBudget = budget.percentage >= 80 && budget.percentage < 100
  const _isCategoryBudget = !!budget.category_id

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {budget.category_color && (
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: budget.category_color }}
              />
            )}
            <CardTitle className="text-base">
              {budget.category_name || "总预算"}
            </CardTitle>
          </div>
          {isOverBudget ? (
            <Badge variant="destructive">已超支</Badge>
          ) : isNearBudget ? (
            <Badge variant="default" className="bg-yellow-500">
              接近限额
            </Badge>
          ) : (
            <Badge variant="secondary">正常</Badge>
          )}
        </div>
        <CardDescription>
          {budget.month}月 {budget.year}年
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">预算限额</span>
            <span className="font-semibold">¥{budget.amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">已支出</span>
            <span className="font-semibold text-red-500">
              ¥{budget.spent.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">剩余</span>
            <span
              className={cn(
                "font-semibold",
                isOverBudget ? "text-red-500" : "text-green-500",
              )}
            >
              {isOverBudget ? "-" : ""}¥{Math.abs(budget.remaining).toFixed(2)}
            </span>
          </div>
          <Progress
            value={Math.min(budget.percentage, 100)}
            className={cn(
              "h-2",
              isOverBudget
                ? "bg-red-200"
                : isNearBudget
                  ? "bg-yellow-200"
                  : "bg-green-200",
            )}
          />
          <p className="text-xs text-muted-foreground text-right">
            {budget.percentage.toFixed(1)}%
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetAlerts() {
  const today = new Date()
  const { data: overbudget } = useSuspenseQuery(
    getOverbudgetQueryOptions(today.getFullYear(), today.getMonth() + 1),
  )

  if (!overbudget.overbudget_items?.length) {
    return null
  }

  return (
    <div className="space-y-2">
      {overbudget.overbudget_items.map((item: any) => (
        <Card
          key={item.id}
          className={cn(
            item.is_overbudget
              ? "border-red-200 bg-red-50 dark:bg-red-950/20"
              : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20",
          )}
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {item.is_overbudget ? (
                <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {item.category_name || "总预算"}{" "}
                  {item.is_overbudget ? "已超支" : "接近限额"}
                </p>
                <p className="text-sm text-muted-foreground">
                  预算 ¥{item.amount.toFixed(2)}，已支出 ¥
                  {item.spent.toFixed(2)}，{item.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BudgetList() {
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  const { data: budgets } = useSuspenseQuery(
    getBudgetsQueryOptions(selectedYear, selectedMonth),
  )

  if (budgets.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <PieChart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">您还没有设置预算</h3>
        <p className="text-muted-foreground">设置预算来控制您的支出</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}年
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selectedMonth.toString()}
          onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}
        >
          <SelectTrigger className="w-24">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.data.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} />
        ))}
      </div>
    </div>
  )
}

function Budgets() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">预算管理</h1>
          <p className="text-muted-foreground">设置和管理您的月度预算</p>
        </div>
        <AddBudget />
      </div>

      <Suspense fallback={null}>
        <BudgetAlerts />
      </Suspense>

      <Suspense fallback={<PendingBudgets />}>
        <BudgetList />
      </Suspense>
    </div>
  )
}
