import { Search } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

function PendingCategoryRow() {
  return (
    <div className="grid grid-cols-12 gap-4 py-4 border-b px-6">
      <div className="col-span-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="col-span-3">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="col-span-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="col-span-1">
        <Skeleton className="h-4 w-8 justify-self-end" />
      </div>
    </div>
  )
}

export default function PendingCategories() {
  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <Skeleton className="h-9 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <PendingCategoryRow key={i} />
      ))}
    </div>
  )
}
