import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Book,
  BookOpen,
  Clapperboard,
  Edit2,
  Eye,
  EyeOff,
  Film,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  Trash2,
  Tv,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import {
  MediaCollectionService,
  MediaStatus,
  MediaStatusColors,
  MediaStatusLabels,
  MediaType,
  MediaTypeLabels,
  type MediaCollectionCreate,
  type MediaCollectionPublic,
  type MediaCollectionStatistics,
  type MediaTagPublic,
} from "@/services/MediaCollectionService"
import { handleError } from "@/utils"

function getCollectionsQueryOptions({
  media_type,
  status,
  search,
  tag_id,
}: {
  media_type?: MediaType
  status?: MediaStatus
  search?: string
  tag_id?: string
} = {}) {
  return {
    queryFn: () =>
      MediaCollectionService.getCollections({
        skip: 0,
        limit: 100,
        media_type,
        status,
        search: search || undefined,
        tag_id: tag_id || undefined,
      }),
    queryKey: ["mediaCollections", media_type, status, search, tag_id],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }
}

function getStatisticsQueryOptions() {
  return {
    queryFn: () => MediaCollectionService.getCollectionStats(),
    queryKey: ["mediaCollectionStats"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  }
}

function getTagsQueryOptions() {
  return {
    queryFn: () => MediaCollectionService.getTags({ limit: 100 }),
    queryKey: ["mediaTags"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  }
}

export const Route = createFileRoute("/_layout/collections")({
  component: MediaCollections,
  head: () => ({
    meta: [
      {
        title: "收藏管理 - FastAPI Template",
      },
    ],
  }),
})

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
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
      </CardContent>
    </Card>
  )
}

function Statistics({
  stats,
  isLoading,
}: {
  stats: MediaCollectionStatistics | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(5)].map((_, i) => (
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

  if (!stats) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard title="总收藏" value={stats.total_items} icon={BookOpen} color="text-blue-500" />
      <StatCard title="想看" value={stats.want_to_watch} icon={Eye} color="text-cyan-500" />
      <StatCard title="在看" value={stats.watching} icon={Eye} color="text-green-500" />
      <StatCard title="已完成" value={stats.completed} icon={Check} color="text-purple-500" />
      <StatCard title="书籍" value={stats.books} icon={Book} color="text-orange-500" />
    </div>
  )
}

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function MediaCard({
  collection,
  tags,
  onEdit,
  onDelete,
}: {
  collection: MediaCollectionPublic
  tags: MediaTagPublic[]
  onEdit: (collection: MediaCollectionPublic) => void
  onDelete: (id: string) => void
}) {
  const MediaIcon =
    collection.media_type === MediaType.BOOK
      ? Book
      : collection.media_type === MediaType.MOVIE
        ? Film
        : Tv

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MediaIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg truncate max-w-[200px]">
              {collection.title}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit(collection)}>
                <Edit2 className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(collection.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {collection.original_title && (
          <CardDescription className="text-xs">
            {collection.original_title}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            {MediaTypeLabels[collection.media_type]}
          </Badge>
          <Badge
            className={`${MediaStatusColors[collection.status]} text-white text-xs`}
          >
            {MediaStatusLabels[collection.status]}
          </Badge>
          {collection.rating !== null && collection.rating !== undefined && (
            <Badge variant="secondary" className="text-xs">
              ⭐ {collection.rating.toFixed(1)}
            </Badge>
          )}
          {collection.year && (
            <Badge variant="outline" className="text-xs">
              {collection.year}
            </Badge>
          )}
        </div>
        {collection.tag_names && collection.tag_names.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {collection.tag_names.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {collection.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {collection.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex gap-2">
          {collection.author && (
            <span className="text-xs text-muted-foreground">
              作者: {collection.author}
            </span>
          )}
          {collection.director && (
            <span className="text-xs text-muted-foreground">
              导演: {collection.director}
            </span>
          )}
        </div>
        {collection.is_private && (
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        )}
      </CardFooter>
    </Card>
  )
}

function CollectionForm({
  collection,
  tags,
  onSubmit,
  onCancel,
}: {
  collection?: MediaCollectionPublic
  tags: MediaTagPublic[]
  onSubmit: (data: MediaCollectionCreate) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<MediaCollectionCreate>({
    title: collection?.title || "",
    original_title: collection?.original_title || null,
    media_type: collection?.media_type || MediaType.BOOK,
    status: collection?.status || MediaStatus.WANT_TO_WATCH,
    rating: collection?.rating ?? null,
    description: collection?.description || null,
    notes: collection?.notes || null,
    cover_image: collection?.cover_image || null,
    year: collection?.year ?? null,
    genre: collection?.genre || null,
    author: collection?.author || null,
    director: collection?.director || null,
    episodes: collection?.episodes ?? null,
    is_private: collection?.is_private || false,
    tag_ids: [],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="输入标题"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="original_title">原标题</Label>
          <Input
            id="original_title"
            value={formData.original_title || ""}
            onChange={(e) =>
              setFormData({ ...formData, original_title: e.target.value || null })
            }
            placeholder="输入原标题"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="media_type">类型</Label>
          <Select
            value={formData.media_type}
            onValueChange={(v) =>
              setFormData({ ...formData, media_type: v as MediaType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MediaType.BOOK}>
                <span className="flex items-center gap-2">
                  <Book className="h-4 w-4" /> 书籍
                </span>
              </SelectItem>
              <SelectItem value={MediaType.MOVIE}>
                <span className="flex items-center gap-2">
                  <Film className="h-4 w-4" /> 电影
                </span>
              </SelectItem>
              <SelectItem value={MediaType.TV_SHOW}>
                <span className="flex items-center gap-2">
                  <Tv className="h-4 w-4" /> 电视剧
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">状态</Label>
          <Select
            value={formData.status}
            onValueChange={(v) =>
              setFormData({ ...formData, status: v as MediaStatus })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MediaStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {MediaStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rating">评分 (0-10)</Label>
          <Input
            id="rating"
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={formData.rating ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                rating: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            placeholder="0-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">年份</Label>
          <Input
            id="year"
            type="number"
            min="1000"
            max="2100"
            value={formData.year ?? ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                year: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            placeholder="例如: 2024"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">
            {formData.media_type === MediaType.BOOK ? "作者" : "演员"}
          </Label>
          <Input
            id="author"
            value={formData.author || ""}
            onChange={(e) => setFormData({ ...formData, author: e.target.value || null })}
            placeholder={formData.media_type === MediaType.BOOK ? "作者名字" : "演员名字"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="director">导演</Label>
          <Input
            id="director"
            value={formData.director || ""}
            onChange={(e) =>
              setFormData({ ...formData, director: e.target.value || null })
            }
            placeholder="导演名字"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="genre">类型/分类</Label>
        <Input
          id="genre"
          value={formData.genre || ""}
          onChange={(e) => setFormData({ ...formData, genre: e.target.value || null })}
          placeholder="例如: 科幻, 爱情, 悬疑"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">简介</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value || null })
          }
          placeholder="简介内容"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
          placeholder="个人备注"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_private"
          checked={formData.is_private}
          onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
          className="rounded border-gray-300"
        />
        <Label htmlFor="is_private" className="cursor-pointer">
          <EyeOff className="inline mr-1 h-4 w-4" />
          设为私有
        </Label>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          {collection ? "保存修改" : "添加收藏"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function MediaCollections() {
  const [mediaType, setMediaType] = useState<MediaType | undefined>(undefined)
  const [status, setStatus] = useState<MediaStatus | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editCollection, setEditCollection] = useState<MediaCollectionPublic | undefined>(
    undefined
  )

  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery(getStatisticsQueryOptions())

  const {
    data: collections,
    isLoading: collectionsLoading,
  } = useQuery(
    getCollectionsQueryOptions({
      media_type: mediaType,
      status,
      search,
    }),
  )

  const {
    data: tagsData,
    isLoading: tagsLoading,
  } = useQuery(getTagsQueryOptions())

  const tags = tagsData?.data || []

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: MediaCollectionCreate) =>
      MediaCollectionService.createCollection({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("收藏添加成功")
      setAddDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["mediaCollections"] })
      queryClient.invalidateQueries({ queryKey: ["mediaCollectionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: MediaCollectionCreate
    }) =>
      MediaCollectionService.updateCollection({
        collection_id: id,
        requestBody: data,
      }),
    onSuccess: () => {
      showSuccessToast("收藏更新成功")
      setEditCollection(undefined)
      queryClient.invalidateQueries({ queryKey: ["mediaCollections"] })
      queryClient.invalidateQueries({ queryKey: ["mediaCollectionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      MediaCollectionService.deleteCollection({ collection_id: id }),
    onSuccess: () => {
      showSuccessToast("收藏删除成功")
      queryClient.invalidateQueries({ queryKey: ["mediaCollections"] })
      queryClient.invalidateQueries({ queryKey: ["mediaCollectionStats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleCreate = (data: MediaCollectionCreate) => {
    createMutation.mutate(data)
  }

  const handleUpdate = (data: MediaCollectionCreate) => {
    if (editCollection) {
      updateMutation.mutate({ id: editCollection.id, data })
    }
  }

  const handleDelete = (id: string) => {
    if (window.confirm("确定要删除这个收藏吗？")) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">收藏管理</h1>
          <p className="text-muted-foreground">
            管理您的书籍、电影、电视剧收藏
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加收藏
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加新收藏</DialogTitle>
              <DialogDescription>
                添加一个新的书籍、电影或电视剧收藏
              </DialogDescription>
            </DialogHeader>
            <CollectionForm
              tags={tags}
              onSubmit={handleCreate}
              onCancel={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Statistics stats={stats} isLoading={statsLoading} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={mediaType || "all"}
              onValueChange={(v) =>
                setMediaType(v === "all" ? undefined : (v as MediaType))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value={MediaType.BOOK}>
                  <span className="flex items-center gap-2">
                    <Book className="h-4 w-4" /> 书籍
                  </span>
                </SelectItem>
                <SelectItem value={MediaType.MOVIE}>
                  <span className="flex items-center gap-2">
                    <Film className="h-4 w-4" /> 电影
                  </span>
                </SelectItem>
                <SelectItem value={MediaType.TV_SHOW}>
                  <span className="flex items-center gap-2">
                    <Tv className="h-4 w-4" /> 电视剧
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={status || "all"}
              onValueChange={(v) =>
                setStatus(v === "all" ? undefined : (v as MediaStatus))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.values(MediaStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {MediaStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 max-w-sm ml-auto">
              <div className="flex gap-2">
                <Input
                  placeholder="搜索标题、简介..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {collectionsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-5 w-3/4 bg-muted rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-full bg-muted rounded mb-2" />
                    <div className="h-4 w-2/3 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !collections || collections.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Clapperboard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">
                {search ? "没有找到匹配的收藏" : "您还没有任何收藏"}
              </h3>
              <p className="text-muted-foreground">
                {search
                  ? "尝试使用其他关键词搜索"
                  : "点击上方按钮添加第一个收藏"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collections.data.map((collection) => (
                <MediaCard
                  key={collection.id}
                  collection={collection}
                  tags={tags}
                  onEdit={setEditCollection}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editCollection}
        onOpenChange={(open) => !open && setEditCollection(undefined)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑收藏</DialogTitle>
            <DialogDescription>
              修改收藏的详细信息
            </DialogDescription>
          </DialogHeader>
          {editCollection && (
            <CollectionForm
              collection={editCollection}
              tags={tags}
              onSubmit={handleUpdate}
              onCancel={() => setEditCollection(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
