import { Skeleton } from "@/components/ui/skeleton"

function PendingTransactionRow() {
  return (
    <div className="grid grid-cols-12 gap-4 py-4 border-b px-6">
      <div className="col-span-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="col-span-2">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="col-span-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="col-span-1">
        <Skeleton className="h-4 w-8 justify-self-end" />
      </div>
    </div>
  )
}

export default function PendingTransactions() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <PendingTransactionRow key={i} />
      ))}
    </div>
  )
}
