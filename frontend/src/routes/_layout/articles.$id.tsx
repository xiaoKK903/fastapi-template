import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowLeft,
  Archive,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Save,
  Tag,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Separator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui"
import useCustomToast from "@/hooks/useCustomToast"
import {
  ArticleStatus,
  type ArticlePublic,
  type ArticleUpdate,
  ArticlesService,
  type ArticleCreate,
} from "@/services/ArticlesService"
import {
  ArticleCategoriesService,
  type ArticleCategoryPublic,
} from "@/services/ArticleCategoriesService"
import {
  ArticleTagsService,
  type ArticleTagPublic,
} from "@/services/ArticleTagsService"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/articles/$id")({
  component: ArticleEditorPage,
  head: () => ({
    meta: [{ title: "编辑文章 - FastAPI Template" }],
  }),
})

interface ArticleFormValues {
  title: string
  summary: string
  content: string
  category_id: string
  status: ArticleStatus
  is_private: boolean
  tag_ids: string[]
  cover_image: string
}

function ArticleEditorPage() {
  const { id } = useParams({ from: "/_layout/articles/$id" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const isNewArticle = id === "new"
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [isPreview, setIsPreview] = useState(false)

  const form = useForm<ArticleFormValues>({
    defaultValues: {
      title: "",
      summary: "",
      content: "",
      category_id: "",
      status: ArticleStatus.DRAFT,
      is_private: false,
      tag_ids: [],
      cover_image: "",
    },
  })

  const {
    data: categories,
    isLoading: categoriesLoading,
  } = useQuery({
    queryFn: () => ArticleCategoriesService.readCategories({ skip: 0, limit: 100 }),
    queryKey: ["articleCategories"],
    retry: 1,
  })

  const {
    data: tags,
    isLoading: tagsLoading,
  } = useQuery({
    queryFn: () => ArticleTagsService.readTags({ skip: 0, limit: 100 }),
    queryKey: ["articleTags"],
    retry: 1,
  })

  const {
    data: article,
    isLoading: articleLoading,
    error: articleError,
  } = useQuery({
    queryFn: () => ArticlesService.readArticle({ id }),
    queryKey: ["article", id],
    retry: 1,
    enabled: !isNewArticle,
  })

  useEffect(() => {
    if (article) {
      form.reset({
        title: article.title,
        summary: article.summary || "",
        content: article.content || "",
        category_id: article.category_id || "",
        status: article.status,
        is_private: article.is_private,
        tag_ids: article.tag_ids || [],
        cover_image: article.cover_image || "",
      })
      setSelectedTags(article.tag_ids || [])
    }
  }, [article, form])

  const createMutation = useMutation({
    mutationFn: (data: ArticleCreate) => ArticlesService.createArticle({ requestBody: data }),
    onSuccess: (result) => {
      showSuccessToast("文章创建成功")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
      navigate({ to: "/articles/$id", params: { id: result.id } })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; requestBody: ArticleUpdate }) =>
      ArticlesService.updateArticle(data),
    onSuccess: () => {
      showSuccessToast("文章保存成功")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["article", id] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const publishMutation = useMutation({
    mutationFn: (articleId: string) => ArticlesService.publishArticle({ id: articleId }),
    onSuccess: () => {
      showSuccessToast("文章已发布")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["article", id] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const archiveMutation = useMutation({
    mutationFn: (articleId: string) => ArticlesService.archiveArticle({ id: articleId }),
    onSuccess: () => {
      showSuccessToast("文章已归档")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["article", id] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (articleId: string) => ArticlesService.softDeleteArticle({ id: articleId }),
    onSuccess: () => {
      showSuccessToast("文章已移至回收站")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
      navigate({ to: "/articles" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const onSubmit = (values: ArticleFormValues) => {
    const data = {
      title: values.title,
      summary: values.summary || undefined,
      content: values.content || undefined,
      category_id: values.category_id || undefined,
      status: values.status,
      is_private: values.is_private,
      tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
      cover_image: values.cover_image || undefined,
    }

    if (isNewArticle) {
      createMutation.mutate(data)
    } else {
      updateMutation.mutate({ id, requestBody: data })
    }
  }

  const handlePublish = () => {
    if (isNewArticle) {
      const values = form.getValues()
      createMutation.mutate({
        ...values,
        summary: values.summary || undefined,
        content: values.content || undefined,
        category_id: values.category_id || undefined,
        status: ArticleStatus.PUBLISHED,
        tag_ids: selectedTags.length > 0 ? selectedTags : undefined,
        cover_image: values.cover_image || undefined,
      })
    } else {
      publishMutation.mutate(id)
    }
  }

  const handleArchive = () => {
    if (!isNewArticle) {
      archiveMutation.mutate(id)
    }
  }

  const handleDelete = () => {
    if (!isNewArticle) {
      deleteMutation.mutate(id)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleAddNewTag = () => {
    if (!tagInput.trim()) return

    const existingTag = tags?.data.find(
      (t) => t.name.toLowerCase() === tagInput.trim().toLowerCase()
    )

    if (existingTag) {
      if (!selectedTags.includes(existingTag.id)) {
        setSelectedTags((prev) => [...prev, existingTag.id])
      }
      setTagInput("")
      return
    }

    ArticleTagsService.createTag({
      requestBody: { name: tagInput.trim() },
    }).then((newTag) => {
      queryClient.invalidateQueries({ queryKey: ["articleTags"] })
      setSelectedTags((prev) => [...prev, newTag.id])
      setTagInput("")
      showSuccessToast(`标签 "${newTag.name}" 创建成功`)
    }).catch((error) => {
      handleError(error)
      showErrorToast("创建标签失败")
    })
  }

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    ArticlesService.uploadCoverImage({ file })
      .then((result) => {
        form.setValue("cover_image", result.url)
        showSuccessToast("封面上传成功")
      })
      .catch((error) => {
        handleError(error)
        showErrorToast("上传封面失败")
      })
  }

  const isLoading = articleLoading && !isNewArticle

  const getStatusBadge = (status?: ArticleStatus) => {
    if (!status) return null
    switch (status) {
      case ArticleStatus.DRAFT:
        return <Badge variant="outline">草稿</Badge>
      case ArticleStatus.PUBLISHED:
        return <Badge variant="default">已发布</Badge>
      case ArticleStatus.ARCHIVED:
        return <Badge variant="secondary">已归档</Badge>
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate({ to: "/_layout/articles" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {isNewArticle ? "新建文章" : "编辑文章"}
              </h1>
              {!isNewArticle && getStatusBadge(article?.status)}
            </div>
            {article?.created_at && (
              <p className="text-sm text-muted-foreground">
                创建于 {new Date(article.created_at).toLocaleString("zh-CN")}
                {article.updated_at &&
                  ` · 更新于 ${new Date(article.updated_at).toLocaleString("zh-CN")}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsPreview(!isPreview)}
            title={isPreview ? "编辑模式" : "预览模式"}
          >
            {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => form.handleSubmit(onSubmit)()}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
          <Button
            onClick={handlePublish}
            disabled={
              createMutation.isPending ||
              updateMutation.isPending ||
              publishMutation.isPending
            }
            variant="default"
          >
            <Check className="mr-2 h-4 w-4" />
            {article?.status === ArticleStatus.PUBLISHED ? "更新发布" : "发布"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-muted-foreground">加载中...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>文章内容</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>标题 *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="请输入文章标题"
                              {...field}
                              className="text-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>摘要</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="文章摘要（可选，用于列表展示）"
                              {...field}
                              value={field.value || ""}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>正文</FormLabel>
                          <FormControl>
                            {isPreview ? (
                              <div className="min-h-[400px] p-4 border rounded-md whitespace-pre-wrap bg-card">
                                {field.value || "暂无内容"}
                              </div>
                            ) : (
                              <Textarea
                                placeholder="请输入文章内容..."
                                {...field}
                                value={field.value || ""}
                                rows={16}
                                className="font-mono text-sm"
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>发布设置</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>状态</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(v) => field.onChange(v as ArticleStatus)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={ArticleStatus.DRAFT}>草稿</SelectItem>
                              <SelectItem value={ArticleStatus.PUBLISHED}>已发布</SelectItem>
                              <SelectItem value={ArticleStatus.ARCHIVED}>已归档</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>分类</FormLabel>
                          <Select
                            value={field.value || "none"}
                            onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择分类（可选）" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">无分类</SelectItem>
                              {categories?.data.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  <span className="flex items-center gap-2">
                                    {cat.color && (
                                      <span
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: cat.color || undefined }}
                                      />
                                    )}
                                    {cat.name}
                                    {cat.article_count !== undefined &&
                                      cat.article_count > 0 && (
                                        <span className="text-muted-foreground text-xs">
                                          ({cat.article_count})
                                        </span>
                                      )}
                                  </span>
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
                      name="is_private"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">私有文章</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              仅自己可见
                            </p>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>标签</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入标签名称"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNewTag()}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddNewTag}
                      >
                        添加
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tags?.data.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag.id)}
                          style={
                            selectedTags.includes(tag.id) && tag.color
                              ? { backgroundColor: tag.color || undefined }
                              : undefined
                          }
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>封面图片</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-center">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                        {form.getValues("cover_image") ? (
                          <div className="flex flex-col items-center">
                            <img
                              src={form.getValues("cover_image")}
                              alt="封面"
                              className="h-24 w-auto rounded"
                            />
                            <span className="text-xs text-muted-foreground mt-2">
                              点击更换图片
                            </span>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              点击上传封面图片
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleCoverUpload}
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {!isNewArticle && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleArchive}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {article?.status === ArticleStatus.ARCHIVED ? "取消归档" : "归档文章"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除文章
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
