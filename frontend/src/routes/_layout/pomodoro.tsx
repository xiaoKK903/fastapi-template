import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Clock,
  Coffee,
  Target,
  CheckCircle2,
  XCircle,
  Trash2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  ChevronUp,
  ChevronDown,
  Timer,
} from "lucide-react"

import {
  PomodoroService,
  PomodoroSessionType,
  PomodoroSessionStatus,
  type PomodoroSettingsPublic,
  type PomodoroSessionPublic,
  type PomodoroDailyStats,
} from "@/services/PomodoroService"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/pomodoro")({
  component: PomodoroPage,
  head: () => ({
    meta: [
      {
        title: "番茄专注 - FastAPI Template",
      },
    ],
  }),
})

type TimerState = "idle" | "running" | "paused" | "completed"

function PomodoroPage() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["pomodoro-settings"],
    queryFn: PomodoroService.getSettings,
  })

  const { data: todayStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["pomodoro-daily-stats"],
    queryFn: PomodoroService.getDailyStats,
    refetchInterval: 60000,
  })

  const { data: todaySessions, isLoading: isSessionsLoading } = useQuery({
    queryKey: ["pomodoro-today-sessions"],
    queryFn: PomodoroService.getTodaySessions,
    refetchInterval: 60000,
  })

  const [currentSessionType, setCurrentSessionType] = useState<PomodoroSessionType>(
    PomodoroSessionType.FOCUS,
  )
  const [currentSession, setCurrentSession] = useState<PomodoroSessionPublic | null>(null)
  const [timerState, setTimerState] = useState<TimerState>("idle")
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [totalTime, setTotalTime] = useState(25 * 60)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionDescription, setSessionDescription] = useState("")
  const [completedCount, setCompletedCount] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (settings) {
      const duration = currentSessionType === PomodoroSessionType.FOCUS
        ? settings.focus_duration_minutes
        : currentSessionType === PomodoroSessionType.SHORT_BREAK
        ? settings.short_break_duration_minutes
        : settings.long_break_duration_minutes
      const seconds = duration * 60
      setTotalTime(seconds)
      setTimeLeft(seconds)
    }
  }, [settings, currentSessionType, timerState])

  useEffect(() => {
    if (todaySessions?.data) {
      const focusSessions = todaySessions.data.filter(
        (s) => s.session_type === PomodoroSessionType.FOCUS &&
          s.status === PomodoroSessionStatus.COMPLETED,
      )
      setCompletedCount(focusSessions.length)
    }
  }, [todaySessions])

  const playSound = useCallback(() => {
    if (settings?.sound_enabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(console.error)
    }
  }, [settings])

  const showNotification = useCallback((title: string, body: string) => {
    if (settings?.notification_enabled && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body })
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission()
      }
    }
  }, [settings])

  const startSessionMutation = useMutation({
    mutationFn: PomodoroService.createSession,
    onSuccess: (data) => {
      setCurrentSession(data)
      PomodoroService.startSession({ session_id: data.id })
        .then((updated) => {
          setCurrentSession(updated)
        })
        .catch(console.error)
    },
  })

  const pauseSessionMutation = useMutation({
    mutationFn: PomodoroService.pauseSession,
  })

  const resumeSessionMutation = useMutation({
    mutationFn: PomodoroService.resumeSession,
  })

  const completeSessionMutation = useMutation({
    mutationFn: PomodoroService.completeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pomodoro-daily-stats"] })
      queryClient.invalidateQueries({ queryKey: ["pomodoro-today-sessions"] })
    },
  })

  const cancelSessionMutation = useMutation({
    mutationFn: PomodoroService.cancelSession,
  })

  const deleteSessionMutation = useMutation({
    mutationFn: PomodoroService.deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pomodoro-today-sessions"] })
    },
  })

  const startTimer = useCallback(() => {
    if (timerState === "idle") {
      startSessionMutation.mutate({
        requestBody: {
          session_type: currentSessionType,
          duration_minutes: totalTime / 60,
          title: sessionTitle || undefined,
          description: sessionDescription || undefined,
        },
      })
    } else if (timerState === "paused" && currentSession) {
      resumeSessionMutation.mutate({ session_id: currentSession.id })
    }

    setTimerState("running")
    startTimeRef.current = Date.now() - elapsedTime * 1000

    timerRef.current = setInterval(() => {
      if (startTimeRef.current === null) return

      const elapsedMs = Date.now() - startTimeRef.current
      const elapsedSeconds = Math.floor(elapsedMs / 1000)

      setElapsedTime(elapsedSeconds)
      const newTimeLeft = totalTime - elapsedSeconds

      if (newTimeLeft <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setTimeLeft(0)
        setElapsedTime(totalTime)
        setTimerState("completed")

        playSound()

        const message = currentSessionType === PomodoroSessionType.FOCUS
          ? "专注时间结束！休息一下吧。"
          : "休息时间结束！准备开始新的专注。"
        showNotification("番茄钟完成", message)
        toast.success(message)

        if (currentSession) {
          completeSessionMutation.mutate({
            session_id: currentSession.id,
            actual_duration_seconds: totalTime,
          })
        }

        if (settings && settings.auto_start_breaks && currentSessionType === PomodoroSessionType.FOCUS) {
          const nextType = (completedCount + 1) % settings.sessions_before_long_break === 0
            ? PomodoroSessionType.LONG_BREAK
            : PomodoroSessionType.SHORT_BREAK
          setCurrentSessionType(nextType)
          setTimerState("idle")
          setElapsedTime(0)
          setCurrentSession(null)
          setSessionTitle("")
          setSessionDescription("")
        }
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 100)
  }, [
    timerState,
    currentSessionType,
    totalTime,
    elapsedTime,
    currentSession,
    sessionTitle,
    sessionDescription,
    completedCount,
    settings,
    playSound,
    showNotification,
    startSessionMutation,
    resumeSessionMutation,
    completeSessionMutation,
  ])

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setTimerState("paused")

    if (currentSession) {
      pauseSessionMutation.mutate({ session_id: currentSession.id })
    }
  }, [currentSession, pauseSessionMutation])

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (currentSession && timerState === "running") {
      cancelSessionMutation.mutate({ session_id: currentSession.id })
    }

    setTimerState("idle")
    setElapsedTime(0)
    setCurrentSession(null)
    setSessionTitle("")
    setSessionDescription("")

    if (settings) {
      const duration = currentSessionType === PomodoroSessionType.FOCUS
        ? settings.focus_duration_minutes
        : currentSessionType === PomodoroSessionType.SHORT_BREAK
        ? settings.short_break_duration_minutes
        : settings.long_break_duration_minutes
      setTotalTime(duration * 60)
      setTimeLeft(duration * 60)
    }
  }, [currentSession, timerState, settings, currentSessionType, cancelSessionMutation])

  const switchSessionType = useCallback((type: PomodoroSessionType) => {
    if (timerState === "running") return
    setCurrentSessionType(type)
    setTimerState("idle")
    setElapsedTime(0)
    setCurrentSession(null)
  }, [timerState])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0
  const circumference = 2 * Math.PI * 88
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const getSessionTypeColor = (type: PomodoroSessionType) => {
    switch (type) {
      case PomodoroSessionType.FOCUS:
        return "text-primary"
      case PomodoroSessionType.SHORT_BREAK:
        return "text-green-500"
      case PomodoroSessionType.LONG_BREAK:
        return "text-blue-500"
    }
  }

  const getSessionTypeBgColor = (type: PomodoroSessionType) => {
    switch (type) {
      case PomodoroSessionType.FOCUS:
        return "bg-primary"
      case PomodoroSessionType.SHORT_BREAK:
        return "bg-green-500"
      case PomodoroSessionType.LONG_BREAK:
        return "bg-blue-500"
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`
    }
    return `${secs}秒`
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Tabs defaultValue="timer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timer">计时器</TabsTrigger>
            <TabsTrigger value="history">历史记录</TabsTrigger>
            <TabsTrigger value="stats">统计</TabsTrigger>
          </TabsList>

          <TabsContent value="timer" className="mt-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`cursor-pointer ${
                        currentSessionType === PomodoroSessionType.FOCUS
                          ? "border-primary bg-primary/10"
                          : ""
                      }`}
                      onClick={() => switchSessionType(PomodoroSessionType.FOCUS)}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      专注
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`cursor-pointer ${
                        currentSessionType === PomodoroSessionType.SHORT_BREAK
                          ? "border-green-500 bg-green-500/10"
                          : ""
                      }`}
                      onClick={() => switchSessionType(PomodoroSessionType.SHORT_BREAK)}
                    >
                      <Coffee className="h-3 w-3 mr-1" />
                      短休息
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`cursor-pointer ${
                        currentSessionType === PomodoroSessionType.LONG_BREAK
                          ? "border-blue-500 bg-blue-500/10"
                          : ""
                      }`}
                      onClick={() => switchSessionType(PomodoroSessionType.LONG_BREAK)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      长休息
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-6">
                {timerState === "idle" && (
                  <div className="w-full max-w-md mb-6 space-y-3">
                    <div>
                      <Label htmlFor="session-title">任务名称（可选）</Label>
                      <Input
                        id="session-title"
                        placeholder="例如：完成项目文档"
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="session-desc">备注（可选）</Label>
                      <Textarea
                        id="session-desc"
                        placeholder="添加备注..."
                        value={sessionDescription}
                        onChange={(e) => setSessionDescription(e.target.value)}
                        className="h-20 resize-none"
                      />
                    </div>
                  </div>
                )}

                <div className="relative w-56 h-56 my-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                    <circle
                      cx="90"
                      cy="90"
                      r="88"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted/20"
                    />
                    <circle
                      cx="90"
                      cy="90"
                      r="88"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className={`transition-all duration-100 ${getSessionTypeColor(
                        currentSessionType,
                      )}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`text-5xl font-mono font-bold ${getSessionTypeColor(
                        currentSessionType,
                      )}`}
                    >
                      {formatTime(timeLeft)}
                    </span>
                    {timerState !== "idle" && (
                      <span className="text-sm text-muted-foreground mt-1">
                        {PomodoroSessionTypeLabels[currentSessionType]}
                        {sessionTitle && ` - ${sessionTitle}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  {timerState === "running" ? (
                    <Button
                      size="lg"
                      className={`w-28 ${getSessionTypeBgColor(currentSessionType)} hover:opacity-90`}
                      onClick={pauseTimer}
                    >
                      <Pause className="h-5 w-5 mr-2" />
                      暂停
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className={`w-28 ${getSessionTypeBgColor(currentSessionType)} hover:opacity-90`}
                      onClick={startTimer}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {timerState === "paused" ? "继续" : "开始"}
                    </Button>
                  )}
                  <Button variant="outline" size="lg" onClick={resetTimer}>
                    <RotateCcw className="h-5 w-5 mr-2" />
                    重置
                  </Button>
                </div>

                {todayStats && (
                  <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-md">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{todayStats.total_focus_sessions}</p>
                        <p className="text-xs text-muted-foreground">今日专注次数</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">
                          {Math.round(todayStats.total_focus_minutes)}
                        </p>
                        <p className="text-xs text-muted-foreground">今日专注分钟</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{completedCount}</p>
                        <p className="text-xs text-muted-foreground">本轮专注次数</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>今日专注记录</CardTitle>
              </CardHeader>
              <CardContent>
                {isSessionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : todaySessions?.data && todaySessions.data.length > 0 ? (
                  <div className="space-y-2">
                    {todaySessions.data
                      .sort(
                        (a, b) =>
                          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
                      )
                      .map((session) => (
                        <Card key={session.id} className="overflow-hidden">
                          <div
                            className={`h-1 ${
                              session.session_type === PomodoroSessionType.FOCUS
                                ? "bg-primary"
                                : session.session_type === PomodoroSessionType.SHORT_BREAK
                                ? "bg-green-500"
                                : "bg-blue-500"
                            }`}
                          />
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    session.session_type === PomodoroSessionType.FOCUS
                                      ? "border-primary"
                                      : session.session_type === PomodoroSessionType.SHORT_BREAK
                                      ? "border-green-500"
                                      : "border-blue-500"
                                  }
                                >
                                  {PomodoroSessionTypeLabels[session.session_type]}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">
                                    {session.title || "未命名任务"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    计划 {session.duration_minutes} 分钟
                                    {session.actual_duration_seconds &&
                                      ` · 实际 ${formatDuration(session.actual_duration_seconds)}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`
                                    ${session.status === PomodoroSessionStatus.COMPLETED
                                      ? "bg-green-500/10 text-green-500"
                                      : session.status === PomodoroSessionStatus.RUNNING
                                      ? "bg-primary/10 text-primary"
                                      : session.status === PomodoroSessionStatus.PAUSED
                                      ? "bg-amber-500/10 text-amber-500"
                                      : session.status === PomodoroSessionStatus.CANCELLED
                                      ? "bg-red-500/10 text-red-500"
                                      : "bg-muted/10 text-muted-foreground"
                                    }
                                  `}
                                >
                                  {session.status === PomodoroSessionStatus.COMPLETED ? (
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                  ) : session.status === PomodoroSessionStatus.CANCELLED ? (
                                    <XCircle className="h-3 w-3 mr-1" />
                                  ) : null}
                                  {PomodoroSessionStatusLabels[session.status]}
                                </Badge>
                                {session.status !== PomodoroSessionStatus.RUNNING && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      deleteSessionMutation.mutate({ session_id: session.id })
                                      toast.success("记录已删除")
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>今日还没有专注记录</p>
                    <p className="text-sm">开始你的第一个番茄钟吧！</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>本周专注统计</CardTitle>
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <WeeklyStatsView />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
      />

      <audio ref={audioRef} preload="auto">
        <source
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEkBC13yO/eizEIHWq+8+OWT"
          type="audio/wav"
        />
      </audio>
    </div>
  )
}

function WeeklyStatsView() {
  const { data: weeklyStats, isLoading } = useQuery({
    queryKey: ["pomodoro-weekly-stats"],
    queryFn: PomodoroService.getWeeklyStats,
  })

  const weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

  if (isLoading || !weeklyStats) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const maxMinutes = Math.max(...weeklyStats.days.map((d) => d.total_focus_minutes), 60)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{weeklyStats.total_focus_sessions}</p>
            <p className="text-sm text-muted-foreground">本周专注次数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {Math.round(weeklyStats.total_focus_minutes)}
            </p>
            <p className="text-sm text-muted-foreground">本周专注分钟</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">
              {weeklyStats.total_focus_minutes > 0
                ? Math.round(weeklyStats.total_focus_minutes / 60)
                : 0}
            </p>
            <p className="text-sm text-muted-foreground">本周专注小时</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-4" />

      <p className="text-sm font-medium text-muted-foreground mb-2">每日专注时长</p>
      <div className="space-y-2">
        {weeklyStats.days.map((day, index) => {
          const percentage = maxMinutes > 0 ? (day.total_focus_minutes / maxMinutes) * 100 : 0
          return (
            <div key={index} className="flex items-center gap-3">
              <span className="w-12 text-sm text-muted-foreground">{weekDays[index]}</span>
              <div className="flex-1 h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                <div
                  className="h-full bg-primary/60 rounded-lg transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-3 text-sm">
                  {day.total_focus_sessions > 0 && (
                    <span className="text-muted-foreground">
                      {day.total_focus_sessions}次 · {Math.round(day.total_focus_minutes)}分钟
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: PomodoroSettingsPublic | undefined
}) {
  const queryClient = useQueryClient()

  const [localSettings, setLocalSettings] = useState({
    focus_duration_minutes: 25,
    short_break_duration_minutes: 5,
    long_break_duration_minutes: 15,
    sessions_before_long_break: 4,
    auto_start_breaks: false,
    auto_start_focus: false,
    sound_enabled: true,
    notification_enabled: true,
  })

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        focus_duration_minutes: settings.focus_duration_minutes,
        short_break_duration_minutes: settings.short_break_duration_minutes,
        long_break_duration_minutes: settings.long_break_duration_minutes,
        sessions_before_long_break: settings.sessions_before_long_break,
        auto_start_breaks: settings.auto_start_breaks,
        auto_start_focus: settings.auto_start_focus,
        sound_enabled: settings.sound_enabled,
        notification_enabled: settings.notification_enabled,
      })
    }
  }, [settings, open])

  const updateSettingsMutation = useMutation({
    mutationFn: PomodoroService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pomodoro-settings"] })
      toast.success("设置已保存")
      onOpenChange(false)
    },
    onError: () => {
      toast.error("保存失败")
    },
  })

  const handleSave = () => {
    updateSettingsMutation.mutate(localSettings)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>番茄钟设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="focus-duration" className="flex-1">
                专注时长（分钟）
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      focus_duration_minutes: Math.max(1, prev.focus_duration_minutes - 1),
                    }))
                  }
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Input
                  id="focus-duration"
                  type="number"
                  className="w-20 text-center"
                  value={localSettings.focus_duration_minutes}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      focus_duration_minutes: Math.max(1, parseInt(e.target.value) || 25),
                    }))
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      focus_duration_minutes: Math.min(180, prev.focus_duration_minutes + 1),
                    }))
                  }
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="short-break-duration" className="flex-1">
                短休息时长（分钟）
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      short_break_duration_minutes: Math.max(1, prev.short_break_duration_minutes - 1),
                    }))
                  }
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Input
                  id="short-break-duration"
                  type="number"
                  className="w-20 text-center"
                  value={localSettings.short_break_duration_minutes}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      short_break_duration_minutes: Math.max(1, parseInt(e.target.value) || 5),
                    }))
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      short_break_duration_minutes: Math.min(60, prev.short_break_duration_minutes + 1),
                    }))
                  }
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="long-break-duration" className="flex-1">
                长休息时长（分钟）
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      long_break_duration_minutes: Math.max(1, prev.long_break_duration_minutes - 1),
                    }))
                  }
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Input
                  id="long-break-duration"
                  type="number"
                  className="w-20 text-center"
                  value={localSettings.long_break_duration_minutes}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      long_break_duration_minutes: Math.max(1, parseInt(e.target.value) || 15),
                    }))
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      long_break_duration_minutes: Math.min(60, prev.long_break_duration_minutes + 1),
                    }))
                  }
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sessions-before-long-break" className="flex-1">
                长休息前专注次数
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      sessions_before_long_break: Math.max(1, prev.sessions_before_long_break - 1),
                    }))
                  }
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Input
                  id="sessions-before-long-break"
                  type="number"
                  className="w-20 text-center"
                  value={localSettings.sessions_before_long_break}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      sessions_before_long_break: Math.max(1, parseInt(e.target.value) || 4),
                    }))
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      sessions_before_long_break: Math.min(10, prev.sessions_before_long_break + 1),
                    }))
                  }
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {localSettings.sound_enabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="sound-enabled">完成提示音</Label>
              </div>
              <Checkbox
                id="sound-enabled"
                checked={localSettings.sound_enabled}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    sound_enabled: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {localSettings.notification_enabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="notification-enabled">浏览器通知</Label>
              </div>
              <Checkbox
                id="notification-enabled"
                checked={localSettings.notification_enabled}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    notification_enabled: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-start-breaks" className="flex-1">
                专注结束后自动开始休息
              </Label>
              <Checkbox
                id="auto-start-breaks"
                checked={localSettings.auto_start_breaks}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    auto_start_breaks: checked as boolean,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? "保存中..." : "保存设置"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
