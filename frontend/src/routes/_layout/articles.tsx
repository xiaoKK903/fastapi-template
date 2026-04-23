import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/articles")({
  component: ArticlesLayout,
  head: () => ({
    meta: [{ title: "文章管理 - FastAPI Template" }],
  }),
})

function ArticlesLayout() {
  return <Outlet />
}
