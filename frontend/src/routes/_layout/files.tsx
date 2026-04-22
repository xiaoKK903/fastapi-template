import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Plus,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  Share2,
  Star,
  Search,
  MoreHorizontal,
  ChevronRight,
  Folder,
  File,
  FileImage,
  FileText,
  FileArchive,
  FileVideo,
  FileAudio,
  ChevronLeft,
  RefreshCw,
} from "lucide-react"
import { useState, useCallback } from "react"

import {
  FilesService,
  FoldersService,
  TagsService,
  type FilePublic,
  type FolderPublic,
  type FolderTreeItem,
  type StorageQuota,
} from "@/services/FilesService"
import { handleError } from "@/utils"
import useCustomToast from "@/hooks/useCustomToast"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Progress,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui"

export const Route = createFileRoute("/_layout/files")({
  component: FilesPage,
  head: () => ({
    meta: [
      {
        title: "文件管理 - FastAPI Template",
      },
    ],
  }),
})

function getFileIcon(fileType?: string) {
  switch (fileType) {
    case "image":
      return <FileImage className="h-8 w-8 text-blue-500" />
    case "document":
      return <FileText className="h-8 w-8 text-green-500" />
    case "archive":
      return <FileArchive className="h-8 w-8 text-yellow-500" />
    case "video":
      return <FileVideo className="h-8 w-8 text-purple-500" />
    case "audio":
      return <FileAudio className="h-8 w-8 text-pink-500" />
    default:
      return <File className="h-8 w-8 text-gray-500" />
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function QuotaCard() {
  const { data: quota, isLoading } = useQuery({
    queryKey: ["storageQuota"],
    queryFn: () => FilesService.getQuota(),
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!quota) return null

  const percentage = quota.usage_percentage
  const isWarning = percentage > 80

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">存储空间</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm mb-2">
          <span>{quota.formatted_used}</span>
          <span className="text-muted-foreground">/ {quota.formatted_total}</span>
        </div>
        <Progress
          value={percentage}
          className={isWarning ? "bg-destructive/20" : ""}
        />
        <p className={`text-xs mt-2 ${isWarning ? "text-destructive" : "text-muted-foreground"}`}>
          {isWarning ? "存储空间即将用完！" : `剩余 ${quota.formatted_remaining}`}
        </p>
      </CardContent>
    </Card>
  )
}

function UploadDialog({
  open,
  onOpenChange,
  currentFolderId,
  onUploadComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFolderId?: string
  onUploadComplete: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    setUploading(true)
    setProgress(0)

    let successCount = 0
    for (let i = 0; i < files.length; i++) {
      try {
        await FilesService.uploadFile(files[i], currentFolderId)
        successCount++
      } catch (error) {
        handleError(error)
      }
      setProgress(((i + 1) / files.length) * 100)
    }

    if (successCount > 0) {
      showSuccessToast(`成功上传 ${successCount} 个文件`)
      queryClient.invalidateQueries({ queryKey: ["files"] })
      onUploadComplete()
    }

    setUploading(false)
    setFiles([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription>
            选择要上传的文件，支持拖拽或点击选择
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">点击或拖拽文件到这里</p>
            <p className="text-xs text-muted-foreground mt-1">支持常见格式，单文件最大 100MB</p>
            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">已选择 {files.length} 个文件</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground mr-2">{formatSize(file.size)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeFile(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>上传中...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            取消
          </Button>
          <Button onClick={uploadFiles} disabled={files.length === 0 || uploading}>
            {uploading ? "上传中..." : "上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewFolderDialog({
  open,
  onOpenChange,
  parentId,
  onCreateComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId?: string
  onCreateComplete: () => void
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [folderName, setFolderName] = useState("")
  const [creating, setCreating] = useState(false)

  const createFolder = async () => {
    if (!folderName.trim()) return
    setCreating(true)
    try {
      await FoldersService.createFolder({
        name: folderName.trim(),
        parent_id: parentId,
      })
      showSuccessToast("文件夹创建成功")
      queryClient.invalidateQueries({ queryKey: ["folders"] })
      setFolderName("")
      onCreateComplete()
      onOpenChange(false)
    } catch (error) {
      handleError(error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建文件夹</DialogTitle>
          <DialogDescription>
            输入文件夹名称创建新文件夹
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-name">文件夹名称</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="输入文件夹名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  createFolder()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            取消
          </Button>
          <Button onClick={createFolder} disabled={!folderName.trim() || creating}>
            {creating ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({
  open,
  onOpenChange,
  file,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file?: FilePublic
}) {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [permission, setPermission] = useState("view")
  const [expireHours, setExpireHours] = useState("24")
  const [password, setPassword] = useState("")
  const [maxDownloads, setMaxDownloads] = useState("")
  const [creating, setCreating] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const createShare = async () => {
    if (!file) return
    setCreating(true)
    try {
      const result = await SharesService.createShare({
        file_id: file.id,
        permission: permission,
        password: password || undefined,
        expire_hours: expireHours ? parseInt(expireHours) : undefined,
        max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
      })
      setShareUrl(result.share_url || null)
      showSuccessToast("分享链接已生成")
      queryClient.invalidateQueries({ queryKey: ["shares"] })
    } catch (error) {
      handleError(error)
    } finally {
      setCreating(false)
    }
  }

  const copyUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      showSuccessToast("链接已复制到剪贴板")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open)
      if (!open) {
        setShareUrl(null)
        setPassword("")
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享文件</DialogTitle>
          <DialogDescription>
            配置分享选项生成分享链接
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">分享链接</p>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly />
                <Button onClick={copyUrl}>复制</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>访问权限</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">仅查看</SelectItem>
                  <SelectItem value="download">允许下载</SelectItem>
                  <SelectItem value="edit">允许编辑</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>有效期（小时）</Label>
              <Select value={expireHours} onValueChange={setExpireHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 小时</SelectItem>
                  <SelectItem value="24">24 小时</SelectItem>
                  <SelectItem value="168">7 天</SelectItem>
                  <SelectItem value="720">30 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>访问密码（可选）</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="留空则不需要密码"
              />
            </div>

            <div className="grid gap-2">
              <Label>最大下载次数（可选）</Label>
              <Input
                type="number"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                placeholder="留空则不限制"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {!shareUrl && (
            <Button onClick={createShare} disabled={creating}>
              {creating ? "生成中..." : "生成链接"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FilesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined)
  const [folderPath, setFolderPath] = useState<FolderPublic[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [fileType, setFileType] = useState<string>("")
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [shareDialogFile, setShareDialogFile] = useState<FilePublic | undefined>(undefined)

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ["folders", currentFolderId],
    queryFn: () => FoldersService.readFolders(currentFolderId),
    enabled: !searchTerm,
  })

  const { data: files, isLoading: filesLoading, refetch } = useQuery({
    queryKey: ["files", currentFolderId, searchTerm, fileType],
    queryFn: () => FilesService.readFiles(
      currentFolderId,
      searchTerm || undefined,
      fileType || undefined,
    ),
  })

  const { data: folderTree } = useQuery({
    queryKey: ["folderTree"],
    queryFn: () => FoldersService.readFolderTree(),
    refetchOnWindowFocus: false,
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: (fileId: string) => FilesService.toggleFavorite(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
    onError: handleError,
  })

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => FilesService.deleteFile(fileId),
    onSuccess: () => {
      showSuccessToast("文件已移至回收站")
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
    onError: handleError,
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => FoldersService.deleteFolder(folderId),
    onSuccess: () => {
      showSuccessToast("文件夹已删除")
      queryClient.invalidateQueries({ queryKey: ["folders"] })
    },
    onError: handleError,
  })

  const isLoading = foldersLoading || filesLoading

  const navigateToFolder = (folder: FolderPublic) => {
    setFolderPath(prev => [...prev, folder])
    setCurrentFolderId(folder.id)
  }

  const navigateToParent = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1)
      setFolderPath(newPath)
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : undefined)
    }
  }

  const navigateToRoot = () => {
    setFolderPath([])
    setCurrentFolderId(undefined)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground">管理您的个人文件和文件夹</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNewFolderDialog(true)} variant="outline">
            <FolderPlus className="h-4 w-4 mr-2" />
            新建文件夹
          </Button>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            上传文件
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToParent}
                disabled={folderPath.length === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToRoot}
                className="font-medium"
              >
                根目录
              </Button>
              {folderPath.map((folder, index) => (
                <div key={folder.id} className="flex items-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newPath = folderPath.slice(0, index + 1)
                      setFolderPath(newPath)
                      setCurrentFolderId(newPath[newPath.length - 1].id)
                    }}
                    className="font-medium truncate max-w-32"
                  >
                    {folder.name}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索文件..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="所有类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有类型</SelectItem>
                <SelectItem value="image">图片</SelectItem>
                <SelectItem value="document">文档</SelectItem>
                <SelectItem value="archive">压缩包</SelectItem>
                <SelectItem value="video">视频</SelectItem>
                <SelectItem value="audio">音频</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {folders?.data && folders.data.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">文件夹</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folders.data.map((folder) => (
                      <Card
                        key={folder.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => navigateToFolder(folder)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <Folder className="h-8 w-8 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{folder.name}</p>
                              <p className="text-sm text-muted-foreground">文件夹</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteFolderMutation.mutate(folder.id)
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {files?.data && files.data.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    文件 {folders?.data && folders.data.length > 0 ? `(${files.data.length})` : ""}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.data.map((file) => (
                      <Card key={file.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              {getFileIcon(file.file_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatSize(file.size)}
                              </p>
                              {file.tags && file.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {file.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {file.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{file.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleFavoriteMutation.mutate(file.id)}
                                >
                                  <Star className={`h-4 w-4 mr-2 ${file.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                                  {file.is_favorite ? "取消收藏" : "收藏"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setShareDialogFile(file)}
                                >
                                  <Share2 className="h-4 w-4 mr-2" />
                                  分享
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteFileMutation.mutate(file.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {(!folders?.data || folders.data.length === 0) && (!files?.data || files.data.length === 0) && (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">暂无文件</h3>
                  <p className="text-muted-foreground">上传文件或创建文件夹开始使用</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <QuotaCard />

          {folderTree && folderTree.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">文件夹目录</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {folderTree.map((folder) => (
                    <div key={folder.id}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => navigateToFolder(folder)}
                      >
                        <Folder className="h-4 w-4 mr-2" />
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {folder.file_count}
                        </span>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        currentFolderId={currentFolderId}
        onUploadComplete={() => refetch()}
      />

      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        parentId={currentFolderId}
        onCreateComplete={() => queryClient.invalidateQueries({ queryKey: ["folders"] })}
      />

      <ShareDialog
        open={!!shareDialogFile}
        onOpenChange={(open) => !open && setShareDialogFile(undefined)}
        file={shareDialogFile}
      />
    </div>
  )
}

export default FilesPage
