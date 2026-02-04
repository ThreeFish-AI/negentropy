import Link from "next/link";

const NAV_ITEMS = [
  { href: "/knowledge", label: "Dashboard" },
  { href: "/knowledge/base", label: "Knowledge Base" },
  { href: "/knowledge/graph", label: "Knowledge Graph" },
  { href: "/knowledge/memory", label: "User Memory" },
  { href: "/knowledge/pipelines", label: "Pipelines" },
];

export function KnowledgeNav({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Negentropy Knowledge</p>
          <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
          {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
