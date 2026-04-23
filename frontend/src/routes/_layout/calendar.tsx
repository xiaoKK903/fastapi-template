import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Edit2,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  SchedulesService,
  ScheduleColor,
  ScheduleCategory,
  type SchedulePublic,
  type ScheduleCreate,
  type ScheduleUpdate,
  ScheduleCategoryLabels,
  ScheduleColorNames,
} from "@/services/SchedulesService"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      {
        title: "日程日历 - FastAPI Template",
      },
    ],
  }),
})

type ViewType = "month" | "week" | "day"

const monthNames = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
]

const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

const scheduleColors = [
  ScheduleColor.RED,
  ScheduleColor.ORANGE,
  ScheduleColor.YELLOW,
  ScheduleColor.GREEN,
  ScheduleColor.TEAL,
  ScheduleColor.BLUE,
  ScheduleColor.INDIGO,
  ScheduleColor.PURPLE,
  ScheduleColor.PINK,
  ScheduleColor.GRAY,
]

const scheduleCategories = [
  ScheduleCategory.WORK,
  ScheduleCategory.PERSONAL,
  ScheduleCategory.IMPORTANT,
  ScheduleCategory.MEETING,
  ScheduleCategory.OTHER,
]

const reminderOptions = [
  { value: null, label: "不提醒" },
  { value: 0, label: "准时提醒" },
  { value: 5, label: "提前5分钟" },
  { value: 10, label: "提前10分钟" },
  { value: 15, label: "提前15分钟" },
  { value: 30, label: "提前30分钟" },
  { value: 60, label: "提前1小时" },
  { value: 1440, label: "提前1天" },
]

const formSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500, "标题不能超过500字符"),
  description: z.string().max(2000, "备注不能超过2000字符").nullable().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  color: z.nativeEnum(ScheduleColor).default(ScheduleColor.BLUE),
  category: z.nativeEnum(ScheduleCategory).default(ScheduleCategory.PERSONAL),
  reminder_minutes: z.union([z.number(), z.null()]).optional(),
  is_all_day: z.boolean().default(false),
})

function formatDate(date: Date, format: string): string {
  const weekDaysFull = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  const weekDaysShort = ["日", "一", "二", "三", "四", "五", "六"]
  
  const options: Record<string, string | number> = {
    yyyy: date.getFullYear(),
    MM: (date.getMonth() + 1).toString().padStart(2, "0"),
    M: date.getMonth() + 1,
    dd: date.getDate().toString().padStart(2, "0"),
    d: date.getDate(),
    HH: date.getHours().toString().padStart(2, "0"),
    mm: date.getMinutes().toString().padStart(2, "0"),
    EEEE: weekDaysFull[date.getDay()],
    E: weekDaysShort[date.getDay()],
  }

  let result = format
  for (const [key, value] of Object.entries(options)) {
    result = result.replace(key, String(value))
  }

  return result
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function getWeekDates(date: Date): Date[] {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  startOfWeek.setDate(startOfWeek.getDate() - day)
  
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function getCalendarViewQueryOptions(year: number, month: number) {
  return {
    queryFn: () => SchedulesService.getCalendarView({ year, month }),
    queryKey: ["schedules-calendar", year, month],
  }
}

function getUpcomingQueryOptions(hours: number = 24) {
  return {
    queryFn: () => SchedulesService.getUpcomingSchedules({ hours }),
    queryKey: ["schedules-upcoming", hours],
    refetchInterval: 30000,
  }
}

function getPendingRemindersQueryOptions() {
  return {
    queryFn: () => SchedulesService.getPendingReminders(),
    queryKey: ["schedules-reminders"],
    refetchInterval: 30000,
  }
}

function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<ViewType>("month")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<SchedulePublic | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isEditMode, setIsEditMode] = useState(false)

  const queryClient = useQueryClient()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const {
    data: calendarData,
    isLoading: isCalendarLoading,
    refetch: refetchCalendar,
  } = useQuery(getCalendarViewQueryOptions(year, month))

  const { data: upcomingData, isLoading: isUpcomingLoading } = useQuery(
    getUpcomingQueryOptions(24),
  )

  const { data: remindersData } = useQuery(getPendingRemindersQueryOptions())

  useEffect(() => {
    if (remindersData && remindersData.data.length > 0) {
      for (const schedule of remindersData.data) {
        toast(
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-semibold">{schedule.title}</p>
              <p className="text-sm text-muted-foreground">
                开始时间: {formatDate(new Date(schedule.start_time), "MM-dd HH:mm")}
              </p>
            </div>
          </div>,
          {
            duration: 10000,
          },
        )
      }
    }
  }, [remindersData])

  const monthViewDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(prevYear, prevMonth - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month - 1, day),
        isCurrentMonth: true,
      })
    }

    const remaining = 42 - days.length
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    for (let day = 1; day <= remaining; day++) {
      days.push({
        date: new Date(nextYear, nextMonth - 1, day),
        isCurrentMonth: false,
      })
    }

    return days
  }, [year, month])

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

  const goToPrevious = () => {
    if (viewType === "month") {
      setCurrentDate(new Date(year, month - 2, 1))
    } else if (viewType === "week") {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 1)
      setCurrentDate(newDate)
    }
  }

  const goToNext = () => {
    if (viewType === "month") {
      setCurrentDate(new Date(year, month, 1))
    } else if (viewType === "week") {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 1)
      setCurrentDate(newDate)
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedSchedule(null)
    setIsEditMode(false)
    setIsCreateDialogOpen(true)
  }

  const handleScheduleClick = (schedule: SchedulePublic) => {
    setSelectedSchedule(schedule)
    setIsEditMode(false)
    setIsDetailDialogOpen(true)
  }

  const getEventsForDate = (date: Date): SchedulePublic[] => {
    if (!calendarData) return []
    const dateStr = formatDate(date, "yyyy-MM-dd")
    const dayEvents = calendarData.days.find((d) => d.date === dateStr)
    return dayEvents?.events || []
  }

  const currentViewTitle = useMemo(() => {
    if (viewType === "month") {
      return `${year}年 ${monthNames[month - 1]}`
    } else if (viewType === "week") {
      const start = weekDates[0]
      const end = weekDates[6]
      if (start.getMonth() === end.getMonth()) {
        return `${year}年 ${monthNames[start.getMonth()]} ${start.getDate()}日 - ${end.getDate()}日`
      }
      return `${formatDate(start, "yyyy年M月d日")} - ${formatDate(end, "M月d日")}`
    } else {
      return formatDate(currentDate, "yyyy年M月d日 EEEE")
    }
  }, [viewType, year, month, weekDates, currentDate])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNext}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            今天
          </Button>
          <h2 className="text-xl font-semibold ml-2">{currentViewTitle}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={viewType}
            onValueChange={(v) => setViewType(v as ViewType)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">月视图</SelectItem>
              <SelectItem value="week">周视图</SelectItem>
              <SelectItem value="day">日视图</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => {
            setSelectedDate(new Date())
            setSelectedSchedule(null)
            setIsEditMode(false)
            setIsCreateDialogOpen(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            新建日程
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {isCalendarLoading ? (
            <CalendarSkeleton viewType={viewType} />
          ) : viewType === "month" ? (
            <MonthView
              monthViewDays={monthViewDays}
              getEventsForDate={getEventsForDate}
              isToday={isToday}
              onDayClick={handleDayClick}
              onScheduleClick={handleScheduleClick}
            />
          ) : viewType === "week" ? (
            <WeekView
              weekDates={weekDates}
              getEventsForDate={getEventsForDate}
              isToday={isToday}
              onDayClick={handleDayClick}
              onScheduleClick={handleScheduleClick}
            />
          ) : (
            <DayView
              date={currentDate}
              events={getEventsForDate(currentDate)}
              isToday={isToday}
              onDayClick={handleDayClick}
              onScheduleClick={handleScheduleClick}
            />
          )}
        </div>

        <div className="w-72 border-l p-4 overflow-auto">
          <h3 className="font-semibold mb-4">即将到来</h3>
          {isUpcomingLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : upcomingData && upcomingData.data.length > 0 ? (
            <div className="space-y-2">
              {upcomingData.data.map((schedule) => (
                <Card
                  key={schedule.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleScheduleClick(schedule)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div
                        className="w-1 h-full min-h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: schedule.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{schedule.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(new Date(schedule.start_time), "MM-dd HH:mm")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无即将到来的日程</p>
          )}
        </div>
      </div>

      <ScheduleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        schedule={selectedSchedule}
        isEditMode={isEditMode}
        selectedDate={selectedDate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] })
          queryClient.invalidateQueries({ queryKey: ["schedules-upcoming"] })
          setIsCreateDialogOpen(false)
          setSelectedSchedule(null)
        }}
      />

      <ScheduleDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        schedule={selectedSchedule}
        onEdit={() => {
          setIsDetailDialogOpen(false)
          setIsEditMode(true)
          setIsCreateDialogOpen(true)
        }}
        onDelete={(id) => {
          SchedulesService.softDeleteSchedule({ id })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] })
              queryClient.invalidateQueries({ queryKey: ["schedules-upcoming"] })
              setIsDetailDialogOpen(false)
              setSelectedSchedule(null)
              toast.success("日程已删除")
            })
            .catch((err) => {
              toast.error("删除失败")
              console.error(err)
            })
        }}
      />
    </div>
  )
}

function CalendarSkeleton({ viewType }: { viewType: ViewType }) {
  if (viewType === "month") {
    return (
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }
  if (viewType === "week") {
    return (
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-full" />
        ))}
      </div>
    )
  }
  return <Skeleton className="h-full w-full" />
}

function MonthView({
  monthViewDays,
  getEventsForDate,
  isToday,
  onDayClick,
  onScheduleClick,
}: {
  monthViewDays: { date: Date; isCurrentMonth: boolean }[]
  getEventsForDate: (date: Date) => SchedulePublic[]
  isToday: (date: Date) => boolean
  onDayClick: (date: Date) => void
  onScheduleClick: (schedule: SchedulePublic) => void
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1">
        {monthViewDays.map((day, index) => {
          const events = getEventsForDate(day.date)
          const today = isToday(day.date)

          return (
            <div
              key={index}
              className={`
                border rounded-lg p-1 cursor-pointer hover:bg-muted/50 transition-colors
                ${day.isCurrentMonth ? "bg-card" : "bg-muted/30"}
                ${today ? "ring-2 ring-primary" : ""}
              `}
              onClick={() => onDayClick(day.date)}
            >
              <div
                className={`
                  text-sm font-medium mb-1
                  ${!day.isCurrentMonth ? "text-muted-foreground/50" : ""}
                  ${today ? "text-primary" : ""}
                `}
              >
                {day.date.getDate()}
              </div>
              <div className="space-y-1">
                {events.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: event.color + "20",
                      color: event.color,
                      borderLeft: `2px solid ${event.color}`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onScheduleClick(event)
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{events.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  weekDates,
  getEventsForDate,
  isToday,
  onDayClick,
  onScheduleClick,
}: {
  weekDates: Date[]
  getEventsForDate: (date: Date) => SchedulePublic[]
  isToday: (date: Date) => boolean
  onDayClick: (date: Date) => void
  onScheduleClick: (schedule: SchedulePublic) => void
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-8 gap-1 mb-1">
        <div className="w-16" />
        {weekDates.map((date, index) => (
          <div
            key={index}
            className={`
              text-center py-2 rounded-lg
              ${isToday(date) ? "bg-primary/10" : ""}
            `}
          >
            <div className="text-xs text-muted-foreground">{weekDays[date.getDay()]}</div>
            <div
              className={`
                text-lg font-semibold
                ${isToday(date) ? "text-primary" : ""}
              `}
            >
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 gap-1">
          <div className="w-16">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-12 text-xs text-muted-foreground text-right pr-2"
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {weekDates.map((date, colIndex) => {
            const events = getEventsForDate(date)
            
            return (
              <div
                key={colIndex}
                className={`
                  relative border-l
                  ${isToday(date) ? "bg-primary/5" : ""}
                `}
                onClick={() => onDayClick(date)}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-12 border-b cursor-pointer hover:bg-muted/30"
                  />
                ))}
                {events.map((event) => {
                  const startTime = new Date(event.start_time)
                  const endTime = new Date(event.end_time)
                  if (!isSameDay(startTime, date)) return null

                  const startHour = startTime.getHours() + startTime.getMinutes() / 60
                  const endHour = endTime.getHours() + endTime.getMinutes() / 60
                  const duration = Math.max(endHour - startHour, 0.5)
                  const top = startHour * 48
                  const height = duration * 48

                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer overflow-hidden z-10 hover:opacity-90"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: event.color,
                        color: "white",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onScheduleClick(event)
                      }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="truncate opacity-80">
                        {formatDate(startTime, "HH:mm")} - {formatDate(endTime, "HH:mm")}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayView({
  date,
  events,
  isToday,
  onDayClick,
  onScheduleClick,
}: {
  date: Date
  events: SchedulePublic[]
  isToday: (date: Date) => boolean
  onDayClick: (date: Date) => void
  onScheduleClick: (schedule: SchedulePublic) => void
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="h-full flex flex-col">
      <div className="mb-2">
        <div className="text-sm text-muted-foreground">{weekDays[date.getDay()]}</div>
        <div className={`text-2xl font-semibold ${isToday(date) ? "text-primary" : ""}`}>
          {date.getDate()}日
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex">
          <div className="w-16 flex-shrink-0">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 text-xs text-muted-foreground text-right pr-2"
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>
          <div
            className={`
              flex-1 relative border-l
              ${isToday(date) ? "bg-primary/5" : ""}
            `}
            onClick={() => onDayClick(date)}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b cursor-pointer hover:bg-muted/30"
              />
            ))}
            {events.map((event) => {
              const startTime = new Date(event.start_time)
              const endTime = new Date(event.end_time)

              const startHour = startTime.getHours() + startTime.getMinutes() / 60
              const endHour = endTime.getHours() + endTime.getMinutes() / 60
              const duration = Math.max(endHour - startHour, 0.5)
              const top = startHour * 64
              const height = duration * 64

              return (
                <div
                  key={event.id}
                  className="absolute left-2 right-4 rounded-lg px-3 py-2 cursor-pointer overflow-hidden z-10 hover:opacity-90"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: event.color,
                    color: "white",
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onScheduleClick(event)
                  }}
                >
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-sm opacity-80 mt-1">
                    {formatDate(startTime, "HH:mm")} - {formatDate(endTime, "HH:mm")}
                  </div>
                  {event.description && (
                    <div className="text-sm opacity-80 mt-1 truncate">
                      {event.description}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  isEditMode,
  selectedDate,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: SchedulePublic | null
  isEditMode: boolean
  selectedDate: Date
  onSuccess: () => void
}) {
  const defaultValues = useMemo(() => {
    if (schedule) {
      return {
        title: schedule.title,
        description: schedule.description || "",
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        color: schedule.color,
        category: schedule.category,
        reminder_minutes: schedule.reminder_minutes,
        is_all_day: schedule.is_all_day,
      }
    }

    const now = new Date()
    const start = new Date(selectedDate)
    start.setHours(now.getHours() + 1, 0, 0, 0)

    const end = new Date(start)
    end.setHours(end.getHours() + 1)

    return {
      title: "",
      description: "",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      color: ScheduleColor.BLUE,
      category: ScheduleCategory.PERSONAL,
      reminder_minutes: 15,
      is_all_day: false,
    }
  }, [schedule, selectedDate])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    values: isEditMode && schedule ? {
      title: schedule.title,
      description: schedule.description || "",
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      color: schedule.color,
      category: schedule.category,
      reminder_minutes: schedule.reminder_minutes,
      is_all_day: schedule.is_all_day,
    } : undefined,
  })

  useEffect(() => {
    if (open && !isEditMode && !schedule) {
      const now = new Date()
      const start = new Date(selectedDate)
      start.setHours(now.getHours() + 1, 0, 0, 0)

      const end = new Date(start)
      end.setHours(end.getHours() + 1)

      form.reset({
        title: "",
        description: "",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        color: ScheduleColor.BLUE,
        category: ScheduleCategory.PERSONAL,
        reminder_minutes: 15,
        is_all_day: false,
      })
    }
  }, [open, isEditMode, schedule, selectedDate, form])

  const createMutation = useMutation({
    mutationFn: (data: ScheduleCreate) => SchedulesService.createSchedule({ requestBody: data }),
    onSuccess: () => {
      toast.success("日程创建成功")
      onSuccess()
    },
    onError: () => {
      toast.error("创建失败")
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; requestBody: ScheduleUpdate }) =>
      SchedulesService.updateSchedule(data),
    onSuccess: () => {
      toast.success("日程更新成功")
      onSuccess()
    },
    onError: () => {
      toast.error("更新失败")
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isEditMode && schedule) {
      updateMutation.mutate({
        id: schedule.id,
        requestBody: {
          ...values,
          description: values.description || null,
        },
      })
    } else {
      createMutation.mutate({
        ...values,
        description: values.description || null,
      })
    }
  }

  const isAllDay = form.watch("is_all_day")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "编辑日程" : "新建日程"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题 *</FormLabel>
                  <FormControl>
                    <Input placeholder="输入日程标题" {...field} />
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
                      placeholder="添加备注信息..."
                      className="resize-none h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_all_day"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="mt-0">全天事件</FormLabel>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始时间</FormLabel>
                    <FormControl>
                      <Input
                        type={isAllDay ? "date" : "datetime-local"}
                        {...field}
                        value={isAllDay
                          ? field.value.split("T")[0]
                          : field.value.replace("Z", "").slice(0, 16)}
                        onChange={(e) => {
                          if (isAllDay) {
                            field.onChange(e.target.value + "T00:00:00Z")
                          } else {
                            field.onChange(new Date(e.target.value).toISOString())
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结束时间</FormLabel>
                    <FormControl>
                      <Input
                        type={isAllDay ? "date" : "datetime-local"}
                        {...field}
                        value={isAllDay
                          ? field.value.split("T")[0]
                          : field.value.replace("Z", "").slice(0, 16)}
                        onChange={(e) => {
                          if (isAllDay) {
                            field.onChange(e.target.value + "T23:59:59Z")
                          } else {
                            field.onChange(new Date(e.target.value).toISOString())
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {scheduleCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {ScheduleCategoryLabels[cat]}
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
                name="reminder_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>提醒</FormLabel>
                    <Select
                      value={field.value?.toString() ?? "null"}
                      onValueChange={(v) => {
                        if (v === "null") {
                          field.onChange(null)
                        } else {
                          field.onChange(parseInt(v, 10))
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {reminderOptions.map((opt) => (
                          <SelectItem
                            key={opt.value?.toString() ?? "null"}
                            value={opt.value?.toString() ?? "null"}
                          >
                            {opt.label}
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>颜色</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {scheduleColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`
                            w-8 h-8 rounded-full border-2 transition-transform hover:scale-110
                            ${field.value === color
                              ? "border-ring ring-2 ring-ring/50 scale-110"
                              : "border-transparent"}
                          `}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                          title={ScheduleColorNames[color]}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "保存中..."
                  : isEditMode ? "保存修改" : "创建日程"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleDetailDialog({
  open,
  onOpenChange,
  schedule,
  onEdit,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: SchedulePublic | null
  onEdit: () => void
  onDelete: (id: string) => void
}) {
  if (!schedule) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: schedule.color }}
            />
            <DialogTitle className="text-xl">{schedule.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              style={{
                backgroundColor: schedule.color + "20",
                color: schedule.color,
              }}
            >
              {ScheduleCategoryLabels[schedule.category]}
            </Badge>
            {schedule.is_all_day && <Badge variant="outline">全天</Badge>}
            {schedule.reminder_minutes !== null && schedule.reminder_minutes !== undefined && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {schedule.reminder_minutes === 0
                  ? "准时提醒"
                  : schedule.reminder_minutes < 60
                  ? `提前${schedule.reminder_minutes}分钟`
                  : schedule.reminder_minutes < 1440
                  ? `提前${schedule.reminder_minutes / 60}小时`
                  : `提前${schedule.reminder_minutes / 1440}天`}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {formatDate(new Date(schedule.start_time), "yyyy年M月d日 EEEE")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {schedule.is_all_day
                    ? "全天"
                    : `${formatDate(new Date(schedule.start_time), "HH:mm")} - ${formatDate(new Date(schedule.end_time), "HH:mm")}`}
                </p>
              </div>
            </div>
          </div>

          {schedule.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">备注</p>
              <p className="text-sm whitespace-pre-wrap">{schedule.description}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p>创建时间: {formatDate(new Date(schedule.created_at!), "yyyy-MM-dd HH:mm")}</p>
            {schedule.updated_at && schedule.updated_at !== schedule.created_at && (
              <p>更新时间: {formatDate(new Date(schedule.updated_at), "yyyy-MM-dd HH:mm")}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            className="mr-auto"
            onClick={() => onDelete(schedule.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button type="button" onClick={onEdit}>
            <Edit2 className="h-4 w-4 mr-2" />
            编辑
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
