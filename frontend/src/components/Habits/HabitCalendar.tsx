import { useSuspenseQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { CheckinsService, type CheckinCalendarDay } from "@/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function getCalendarDays(
  year: number,
  month: number,
  checkinDays: CheckinCalendarDay[]
) {
  const checkinMap = new Map(checkinDays.map((d) => [d.date, d]))

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()

  const calendarDays: (CheckinCalendarDay | null)[] = []

  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const checkinDay = checkinMap.get(dateStr)
    calendarDays.push(
      checkinDay || {
        date: dateStr,
        has_checkin: false,
        checkin_count: 0,
      }
    )
  }

  return calendarDays
}

function getMonthName(month: number) {
  const months = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月",
  ]
  return months[month - 1]
}

interface HabitCalendarContentProps {
  habitId: string
  habitName: string
}

function HabitCalendarContent({ habitId, habitName }: HabitCalendarContentProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const { data } = useSuspenseQuery({
    queryKey: ["checkin-calendar", habitId, currentDate.year, currentDate.month],
    queryFn: () =>
      CheckinsService.getCheckinCalendar({
        habit_id: habitId,
        year: currentDate.year,
        month: currentDate.month,
      }),
  })

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentDate.year, currentDate.month, data.days)
  }, [currentDate, data.days])

  const todayStr = useMemo(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  }, [])

  const goToPrevMonth = () => {
    setCurrentDate((prev) => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 }
      }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 }
      }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
          <ChevronLeft className="size-5" />
        </Button>
        <h3 className="text-lg font-semibold">
          {currentDate.year}年 {getMonthName(currentDate.month)}
        </h3>
        <Button variant="ghost" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}

        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={cn(
              "aspect-square flex items-center justify-center text-sm rounded-md",
              day
                ? day.has_checkin
                  ? "bg-green-100 text-green-800 font-medium"
                  : "hover:bg-muted"
                : ""
            )}
          >
            {day && (
              <div
                className={cn(
                  "w-full h-full flex items-center justify-center rounded-md",
                  day.date === todayStr && !day.has_checkin && "ring-2 ring-primary ring-offset-1"
                )}
              >
                {new Date(day.date).getDate()}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100" />
          <span className="text-sm text-muted-foreground">已打卡</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded ring-2 ring-primary ring-offset-1" />
          <span className="text-sm text-muted-foreground">今天</span>
        </div>
      </div>
    </div>
  )
}

interface HabitCalendarProps {
  habitId: string
  habitName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HabitCalendar({
  habitId,
  habitName,
  open,
  onOpenChange,
}: HabitCalendarProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>打卡日历 - {habitName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          }
        >
          <HabitCalendarContent habitId={habitId} habitName={habitName} />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
