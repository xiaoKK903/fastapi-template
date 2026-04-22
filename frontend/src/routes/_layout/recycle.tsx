import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Trash2,
  RefreshCw,
  MoreHorizontal,
  Search,
  File,
  FileImage,
  FileText,
  FileArchive,
  FileVideo,
  FileAudio,
  AlertTriangle,
} from "lucide-react"
import { useState } from "react"

import {
  RecycleService,
  type FilePublic,
} from "@/services/FilesService"
import { handleError } from "@/utils"
import useCustomToast from "@/hooks/useCustomToast"
import {
  Button,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui"

export const Route = createFileRoute("/_layout/recycle")({
  component: RecyclePage,
  head: () => ({
    meta: [
      {
        title: "回收站 - FastAPI Template",
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

function RecyclePage() {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [showEmptyDialog, setShowEmptyDialog] = useState(false)
  const [showRestoreAllDialog, setShowRestoreAllDialog] = useState(false)

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ["trashFiles"],
    queryFn: () => RecycleService.getTrashFiles(0, 1000),
  })

  const { data: stats } = useQuery({
    queryKey: ["trashStats"],
    queryFn: () => RecycleService.getTrashStats(),
    refetchOnWindowFocus: false,
  })

  const restoreMutation = useMutation({
    mutationFn: (fileId: string) => RecycleService.restoreFile(fileId),
    onSuccess: () => {
      showSuccessToast("文件已恢复")
      queryClient.invalidateQueries({ queryKey: ["trashFiles"] })
      queryClient.invalidateQueries({ queryKey: ["trashStats"] })
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
    onError: handleError,
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => RecycleService.permanentDelete(fileId),
    onSuccess: () => {
      showSuccessToast("文件已永久删除")
      queryClient.invalidateQueries({ queryKey: ["trashFiles"] })
      queryClient.invalidateQueries({ queryKey: ["trashStats"] })
    },
    onError: handleError,
  })

  const emptyTrashMutation = useMutation({
    mutationFn: () => RecycleService.emptyTrash(),
    onSuccess: () => {
      showSuccessToast("回收站已清空")
      queryClient.invalidateQueries({ queryKey: ["trashFiles"] })
      queryClient.invalidateQueries({ queryKey: ["trashStats"] })
      setShowEmptyDialog(false)
    },
    onError: handleError,
  })

  const restoreAllMutation = useMutation({
    mutationFn: () => RecycleService.restoreAll(),
    onSuccess: () => {
      showSuccessToast("所有文件已恢复")
      queryClient.invalidateQueries({ queryKey: ["trashFiles"] })
      queryClient.invalidateQueries({ queryKey: ["trashStats"] })
      queryClient.invalidateQueries({ queryKey: ["files"] })
      setShowRestoreAllDialog(false)
    },
    onError: handleError,
  })

  const filteredFiles = files?.data?.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.original_name && file.original_name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  const isEmpty = !isLoading && (!files?.data || files.data.length === 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">回收站</h1>
          <p className="text-muted-foreground">管理已删除的文件</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRestoreAllDialog(true)}
            disabled={isEmpty || restoreAllMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            全部恢复
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowEmptyDialog(true)}
            disabled={isEmpty || emptyTrashMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清空回收站
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>注意</AlertTitle>
        <AlertDescription>
          文件在回收站中保留 30 天后将被自动永久删除。已删除的文件可以恢复或永久删除。
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">文件数量</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{files?.count || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">占用空间</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-bold">
                {stats ? formatSize(stats.total_size) : "0 B"}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">自动删除</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">30 天</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="搜索已删除的文件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            prefix={<Search className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
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
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">回收站为空</h3>
          <p className="text-muted-foreground">已删除的文件将显示在这里</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <Card key={file.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg opacity-75">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                    {file.deleted_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        删除于: {new Date(file.deleted_at).toLocaleString()}
                      </p>
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
                        onClick={() => restoreMutation.mutate(file.id)}
                        disabled={restoreMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        恢复
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(file.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        永久删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空回收站</DialogTitle>
            <DialogDescription>
              此操作将永久删除回收站中的所有文件，无法恢复。确定要继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowEmptyDialog(false)}
              disabled={emptyTrashMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => emptyTrashMutation.mutate()}
              disabled={emptyTrashMutation.isPending}
            >
              {emptyTrashMutation.isPending ? "清空中..." : "清空"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRestoreAllDialog} onOpenChange={setShowRestoreAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>恢复所有文件</DialogTitle>
            <DialogDescription>
              此操作将恢复回收站中的所有文件到它们原来的位置。确定要继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowRestoreAllDialog(false)}
              disabled={restoreAllMutation.isPending}
            >
              取消
            </Button>
            <Button onClick={() => restoreAllMutation.mutate()} disabled={restoreAllMutation.isPending}>
              {restoreAllMutation.isPending ? "恢复中..." : "恢复"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RecyclePage
