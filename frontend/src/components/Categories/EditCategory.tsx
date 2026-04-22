import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Edit2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  CategoriesService,
  type CategoryPublic,
  type CategoryUpdate,
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
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface EditCategoryProps {
  category: CategoryPublic
}

const formSchema = z.object({
  name: z.string().min(1, { message: "分类名称是必填项" }),
  type: z.enum(["income", "expense"]).default("expense"),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const iconOptions = [
  { value: "Utensils", label: "餐饮" },
  { value: "Car", label: "交通" },
  { value: "ShoppingBag", label: "购物" },
  { value: "Home", label: "住房" },
  { value: "Heart", label: "医疗" },
  { value: "School", label: "教育" },
  { value: "Plane", label: "旅行" },
  { value: "Gamepad2", label: "娱乐" },
  { value: "DollarSign", label: "工资" },
  { value: "TrendingUp", label: "投资" },
  { value: "Gift", label: "红包" },
  { value: "CreditCard", label: "其他" },
]

const colorOptions = [
  { value: "#ef4444", label: "红色" },
  { value: "#f97316", label: "橙色" },
  { value: "#eab308", label: "黄色" },
  { value: "#22c55e", label: "绿色" },
  { value: "#3b82f6", label: "蓝色" },
  { value: "#8b5cf6", label: "紫色" },
  { value: "#ec4899", label: "粉色" },
  { value: "#6b7280", label: "灰色" },
]

const EditCategory = ({ category }: EditCategoryProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: category.name,
      type: category.type,
      icon: category.icon || "",
      color: category.color || "",
      description: category.description || "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: { id: string; category: CategoryUpdate }) =>
      CategoriesService.updateCategory({
        id: data.id,
        requestBody: data.category,
      }),
    onSuccess: () => {
      showSuccessToast("分类更新成功")
      setIsOpen(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate({ id: category.id, category: data })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Edit2 className="size-4" />
          <span className="sr-only">编辑</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑分类</DialogTitle>
          <DialogDescription>修改分类的详细信息。</DialogDescription>
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
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-row space-x-4"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="income" id="edit-cat-income" />
                        <Label
                          htmlFor="edit-cat-income"
                          className="text-green-500 font-medium cursor-pointer"
                        >
                          收入
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="expense" id="edit-cat-expense" />
                        <Label
                          htmlFor="edit-cat-expense"
                          className="text-red-500 font-medium cursor-pointer"
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      分类名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：餐饮、交通、工资"
                        type="text"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>图标</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {iconOptions.map((icon) => (
                          <button
                            key={icon.value}
                            type="button"
                            className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                              field.value === icon.value
                                ? "border-primary bg-primary/10"
                                : "border-muted hover:border-primary/50"
                            }`}
                            onClick={() =>
                              field.onChange(
                                field.value === icon.value ? "" : icon.value,
                              )
                            }
                          >
                            {icon.label}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>颜色</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-transform ${
                              field.value === color.value
                                ? "border-primary scale-110"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() =>
                              field.onChange(
                                field.value === color.value ? "" : color.value,
                              )
                            }
                            title={color.label}
                          />
                        ))}
                      </div>
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
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="分类描述（可选）"
                        type="text"
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

export default EditCategory
