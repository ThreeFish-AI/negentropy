import Link from "next/link";

const NAV_ITEMS = [
  { href: "/memory", label: "Dashboard" },
  { href: "/memory/timeline", label: "Timeline" },
  { href: "/memory/facts", label: "Facts" },
  { href: "/memory/audit", label: "Audit" },
];

export function MemoryNav({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <>
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Memory</span>
              <span className="text-zinc-300">/</span>
              <span className="font-semibold text-zinc-900">{title}</span>
            </div>
            {description && (
              <p className="mt-1 text-xs text-zinc-500">{description}</p>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
