import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  CategoriesService,
  type TransactionCreate,
  TransactionsService,
  type TransactionType,
} from "@/client"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface AddTransactionProps {
  onSuccess?: () => void
}

const formSchema = z.object({
  amount: z.coerce.number().positive({ message: "金额必须大于0" }),
  type: z.enum(["income", "expense"]).default("expense"),
  category_id: z.string().min(1, { message: "请选择分类" }),
  transaction_date: z
    .string()
    .default(() => new Date().toISOString().split("T")[0]),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const AddTransaction = ({ onSuccess }: AddTransactionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [selectedType, setSelectedType] = useState<TransactionType>("expense")

  const { data: categories } = useQuery({
    queryKey: ["categories", selectedType],
    queryFn: () =>
      CategoriesService.readCategories({ type: selectedType, limit: 100 }),
    enabled: isOpen,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      amount: 0,
      type: "expense",
      category_id: "",
      transaction_date: new Date().toISOString().split("T")[0],
      description: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: TransactionCreate) =>
      TransactionsService.createTransaction({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("交易记录创建成功")
      form.reset()
      setIsOpen(false)
      onSuccess?.()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      amount: Number(data.amount),
      transaction_date: data.transaction_date,
    })
  }

  const _watchType = form.watch("type")

  const handleTypeChange = (type: string) => {
    setSelectedType(type as TransactionType)
    form.setValue("category_id", "")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          记一笔
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>记一笔</DialogTitle>
          <DialogDescription>记录一笔收入或支出。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>类型</FormLabel>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value)
                        handleTypeChange(value)
                      }}
                      value={field.value}
                      className="flex flex-row space-x-4"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="income" id="type-income" />
                        <Label
                          htmlFor="type-income"
                          className="text-green-500 font-medium text-lg cursor-pointer"
                        >
                          收入
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="expense" id="type-expense" />
                        <Label
                          htmlFor="type-expense"
                          className="text-red-500 font-medium text-lg cursor-pointer"
                        >
                          支出
                        </Label>
                      </div>
                    </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      金额 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ¥
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-8 text-xl font-semibold"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      分类 <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.data?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-2">
                              {category.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                              )}
                              <span>{category.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {!categories?.data?.length && (
                          <SelectItem value="no-category" disabled>
                            暂无分类，请先添加分类
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="添加备注（可选）"
                        className="resize-none"
                        {...field}
                      />
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

export default AddTransaction
