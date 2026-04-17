import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { HabitPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteHabit from "../Habits/DeleteHabit"
import EditHabit from "../Habits/EditHabit"

interface HabitActionsMenuProps {
  habit: HabitPublic
}

export const HabitActionsMenu = ({ habit }: HabitActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditHabit habit={habit} onSuccess={() => setOpen(false)} />
        <DeleteHabit id={habit.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
