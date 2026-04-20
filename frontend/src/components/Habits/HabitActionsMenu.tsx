import { Calendar, EllipsisVertical, Trash2, PenLine } from "lucide-react"
import { useState } from "react"

import type { HabitPublicWithStats } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { HabitCalendar } from "./HabitCalendar"
import DeleteHabit from "./DeleteHabit"
import EditHabit from "./EditHabit"

interface HabitActionsMenuProps {
  habit: HabitPublicWithStats
}

export const HabitActionsMenu = ({ habit }: HabitActionsMenuProps) => {
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setOpen(false); setCalendarOpen(true) }}>
            <Calendar className="mr-2 size-4" />
            <span>查看日历</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <EditHabit habit={habit} onSuccess={() => setOpen(false)} />
          <DeleteHabit id={habit.id} onSuccess={() => setOpen(false)} />
        </DropdownMenuContent>
      </DropdownMenu>

      <HabitCalendar
        habitId={habit.id}
        habitName={habit.name}
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
      />
    </>
  )
}
