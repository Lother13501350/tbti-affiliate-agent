import Link from "next/link";

const TABS: { key: string; href: string; label: string }[] = [
  { key: "dashboard", href: "/admin", label: "儀表板" },
  { key: "products", href: "/admin/products", label: "商品" },
  { key: "review", href: "/admin/review", label: "審核佇列" },
];

export function AdminNav({ adminKey, active }: { adminKey: string; active: string }) {
  const q = `?key=${encodeURIComponent(adminKey)}`;
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        <span className="mr-3 text-sm font-bold">TBTI 聯盟 Agent</span>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`${t.href}${q}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active === t.key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
