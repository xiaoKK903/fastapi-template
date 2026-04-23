import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Archive,
  BarChart3,
  FileText,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCustomToast from "@/hooks/useCustomToast"
import {
  ArticleStatus,
  type ArticleStatistics,
  ArticlesService,
} from "@/services/ArticlesService"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/articles")({
  component: ArticlesPage,
  head: () => ({
    meta: [{ title: "文章管理 - FastAPI Template" }],
  }),
})

function StatCard({
  title,
  value,
  badge,
  badgeVariant,
}: {
  title: string
  value: number
  badge?: string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {badge && <Badge variant={badgeVariant || "outline"}>{badge}</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}

function Statistics({
  stats,
  isLoading,
  error,
}: {
  stats: ArticleStatistics | undefined
  isLoading: boolean
  error: unknown
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-sm font-medium">加载中...</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="text-sm font-medium">--</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="总文章数" value={stats.total_articles} />
      <StatCard
        title="草稿箱"
        value={stats.draft_articles}
        badge="草稿"
      />
      <StatCard
        title="已发布"
        value={stats.published_articles}
        badge="已发布"
        badgeVariant="default"
      />
      <StatCard
        title="已归档"
        value={stats.archived_articles}
        badge="归档"
      />
    </div>
  )
}

function CategoryDistributionChart({
  stats,
}: {
  stats: ArticleStatistics | undefined
}) {
  if (!stats || !stats.category_distribution || stats.category_distribution.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">分类分布</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <span className="text-muted-foreground">暂无分类数据</span>
        </CardContent>
      </Card>
    )
  }

  const chartData = stats.category_distribution.map((cat) => ({
    name: cat.name,
    count: cat.count,
  }))

  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">分类分布</CardTitle>
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "#F9FAFB" }}
            />
            <Legend />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function ArticleCard({
  article,
  onEdit,
}: {
  article: {
    id: string
    title: string
    summary?: string | null
    content?: string | null
    status: ArticleStatus
    category_name?: string | null
    category_color?: string | null
    tag_names?: string[] | null
    tag_colors?: string[] | null
    created_at?: string | null
    updated_at?: string | null
    word_count: number
    views: number
    sensitive_level: string
  }
  onEdit: (id: string) => void
}) {
  const getStatusBadge = (status: ArticleStatus) => {
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("zh-CN")
  }

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={() => onEdit(article.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-1">{article.title}</CardTitle>
          {getStatusBadge(article.status)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {article.summary || (article.content?.slice(0, 150) + "...") || "暂无内容"}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {article.category_name && (
            <Badge
              variant="outline"
              style={{
                backgroundColor: article.category_color || "transparent",
                borderColor: article.category_color || undefined,
              }}
            >
              {article.category_name}
            </Badge>
          )}
          {article.tag_names?.slice(0, 3).map((tag, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {article.tag_names && article.tag_names.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{article.tag_names.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>字数: {article.word_count}</span>
          <span>阅读: {article.views}</span>
          <span>更新: {formatDate(article.updated_at)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ArticlesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [activeTab, setActiveTab] = useState("active")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>(undefined)

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryFn: () => ArticlesService.getStatistics(),
    queryKey: ["articleStatistics"],
    retry: 1,
  })

  const {
    data: articles,
    isLoading: articlesLoading,
    error: articlesError,
  } = useQuery({
    queryFn: () => {
      const includeArchived = activeTab === "archived"
      const includeDeleted = activeTab === "trash"
      const status = activeTab === "drafts" ? ArticleStatus.DRAFT : statusFilter

      return ArticlesService.readArticles({
        skip: 0,
        limit: 50,
        status,
        search: search || undefined,
        include_archived: includeArchived,
        include_deleted: includeDeleted,
      })
    },
    queryKey: ["articles", activeTab, search, statusFilter],
    retry: 1,
  })

  const emptyTrashMutation = useMutation({
    mutationFn: () => ArticlesService.emptyTrash(),
    onSuccess: () => {
      showSuccessToast("回收站已清空")
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["articleStatistics"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handleEditArticle = (id: string) => {
    navigate({ to: "/_layout/articles/$id", params: { id } })
  }

  const handleNewArticle = () => {
    navigate({ to: "/_layout/articles/new" })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文章管理</h1>
          <p className="text-muted-foreground">创建和管理您的私人文章日记</p>
        </div>
        <Button onClick={handleNewArticle}>
          <Plus className="mr-2 h-4 w-4" />
          新建文章
        </Button>
      </div>

      <Statistics stats={stats} isLoading={statsLoading} error={statsError} />

      <div className="grid gap-4 md:grid-cols-2">
        <CategoryDistributionChart stats={stats} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">写作统计</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-center gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">总字数</span>
              <span className="text-xl font-bold">{stats?.total_words?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">总阅读量</span>
              <span className="text-xl font-bold">{stats?.total_views?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">回收站文章</span>
              <span className="text-xl font-bold">{stats?.deleted_articles || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        defaultValue="active"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">全部文章</TabsTrigger>
            <TabsTrigger value="drafts">草稿箱</TabsTrigger>
            <TabsTrigger value="archived">归档</TabsTrigger>
            <TabsTrigger value="trash">回收站</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Input
              placeholder="搜索文章标题、内容..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-[200px]"
            />
            <Button variant="secondary" onClick={handleSearch}>
              搜索
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="mt-4">
          {renderArticleList(
            articles,
            articlesLoading,
            articlesError,
            handleEditArticle,
            activeTab,
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          {renderArticleList(
            articles,
            articlesLoading,
            articlesError,
            handleEditArticle,
            activeTab,
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {renderArticleList(
            articles,
            articlesLoading,
            articlesError,
            handleEditArticle,
            activeTab,
          )}
        </TabsContent>

        <TabsContent value="trash" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">
              回收站中的文章可以恢复或永久删除
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => emptyTrashMutation.mutate()}
              disabled={emptyTrashMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清空回收站
            </Button>
          </div>
          {renderArticleList(
            articles,
            articlesLoading,
            articlesError,
            handleEditArticle,
            activeTab,
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function renderArticleList(
  articles: {
    data: Array<{
      id: string
      title: string
      summary?: string | null
      content?: string | null
      status: ArticleStatus
      category_name?: string | null
      category_color?: string | null
      tag_names?: string[] | null
      tag_colors?: string[] | null
      created_at?: string | null
      updated_at?: string | null
      word_count: number
      views: number
      sensitive_level: string
    }>
    count: number
  } | undefined,
  isLoading: boolean,
  error: unknown,
  onEdit: (id: string) => void,
  activeTab: string,
) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-5 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-12 bg-muted rounded animate-pulse mb-3" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Search className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold">加载失败</h3>
        <p className="text-muted-foreground">请刷新页面重试</p>
      </div>
    )
  }

  if (!articles || articles.data.length === 0) {
    const emptyMessages: Record<string, string> = {
      active: "您还没有任何文章",
      drafts: "草稿箱为空",
      archived: "没有已归档的文章",
      trash: "回收站为空",
    }

    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          {activeTab === "trash" ? (
            <Trash2 className="h-8 w-8 text-muted-foreground" />
          ) : activeTab === "archived" ? (
            <Archive className="h-8 w-8 text-muted-foreground" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold">
          {emptyMessages[activeTab] || "暂无数据"}
        </h3>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {articles.data.map((article) => (
        <ArticleCard key={article.id} article={article} onEdit={onEdit} />
      ))}
    </div>
  )
}
