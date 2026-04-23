import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TaskWithSubtasks } from "@/services/TasksService"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date, format: string): string {
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  
  const options: Record<string, string | number> = {
    yyyy: date.getFullYear(),
    MM: (date.getMonth() + 1).toString().padStart(2, "0"),
    M: date.getMonth() + 1,
    dd: date.getDate().toString().padStart(2, "0"),
    d: date.getDate(),
    EEEE: weekDays[date.getDay()],
  }

  let result = format
  for (const [key, value] of Object.entries(options)) {
    result = result.replace(key, String(value))
  }

  return result
}

export interface FlatTaskWithLevel extends TaskWithSubtasks {
  level: number
  hasChildren: boolean
}

export function flattenTaskTree(
  tasks: TaskWithSubtasks[],
  level: number = 0,
): FlatTaskWithLevel[] {
  const result: FlatTaskWithLevel[] = []

  for (const task of tasks) {
    const flatTask: FlatTaskWithLevel = {
      ...task,
      level,
      hasChildren: task.children && task.children.length > 0,
    }
    result.push(flatTask)

    if (task.children && task.children.length > 0) {
      const children = flattenTaskTree(task.children, level + 1)
      result.push(...children)
    }
  }

  return result
}

export function filterExpandedTasks(
  flatTasks: FlatTaskWithLevel[],
  expandedIds: Set<string>,
): FlatTaskWithLevel[] {
  return flatTasks.filter((task) => {
    if (task.level === 0) return true

    const parentId = task.parent_id
    if (!parentId) return true

    let ancestorId = parentId
    const taskMap = new Map(flatTasks.map((t) => [t.id, t]))

    while (ancestorId) {
      if (!expandedIds.has(ancestorId)) {
        return false
      }
      const ancestor = taskMap.get(ancestorId)
      ancestorId = ancestor?.parent_id || null
    }

    return true
  })
}

export function getAllTaskIds(tasks: TaskWithSubtasks[]): string[] {
  const ids: string[] = []
  for (const task of tasks) {
    ids.push(task.id)
    if (task.children && task.children.length > 0) {
      ids.push(...getAllTaskIds(task.children))
    }
  }
  return ids
}
