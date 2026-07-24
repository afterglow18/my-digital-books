import React, { createContext, useContext, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Shirt, Sparkles, Bookmark, Settings } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "@/hooks/useLocalDB";

// ── Layout context ─────────────────────────────────────────────────────────────
// Pages that measure from the viewport (wardrobe, generate) read navHeight so
// they know how much space the bottom nav consumes. On iPad with a sidebar the
// nav is on the side and takes 0 vertical space.
interface LayoutCtx { navHeight: number }
const LayoutContext = createContext<LayoutCtx>({ navHeight: 90 });
export function useLayoutContext() { return useContext(LayoutContext); }

// ── Shared nav-item type ────────────────────────────────────────────────────────
type NavItemDef = {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  badge?: number;
};

// ── NavButton — works in both bottom-bar and sidebar orientations ───────────────
function NavButton({
  item, location, sidebar = false,
}: {
  item: NavItemDef; location: string; sidebar?: boolean;
}) {
  const isActive = location === item.href;
  const Icon = item.icon;

  return (
    <li className={cn("relative", sidebar && "w-full")}>
      <Link
        href={item.href}
        className={cn(
          "flex flex-col items-center group",
          sidebar ? "gap-0.5 py-1 w-full" : "gap-1",
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center border-2 transition-all duration-200 ease-spring",
            sidebar
              ? cn("p-2.5 rounded-xl w-12 h-12",
                  isActive
                    ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "border-transparent group-hover:bg-muted group-active:scale-95")
              : cn("p-2.5 rounded-full",
                  isActive
                    ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                    : "border-transparent group-hover:bg-muted group-active:scale-95"),
          )}
        >
          <Icon
            className={cn(
              "w-6 h-6",
              isActive ? "text-black" : "text-muted-foreground",
              item.href === "/generate" && isActive ? "animate-pulse" : "",
            )}
            strokeWidth={isActive ? 2.5 : 2}
          />

          {/* Badge */}
          {item.badge != null && item.badge > 0 && (
            <div className="absolute -top-2 -right-2 bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              {item.badge > 99 ? "99+" : item.badge}
            </div>
          )}
        </div>

        <span
          className={cn(
            "font-bold uppercase tracking-wider transition-colors",
            sidebar ? "text-[9px]" : "text-[10px]",
            isActive ? "text-black" : "text-muted-foreground",
          )}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}

// ── AppLayout ──────────────────────────────────────────────────────────────────
interface AppLayoutProps { children: React.ReactNode }

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: stats } = useGetWardrobeStats();
  const isNative = Capacitor.isNativePlatform();

  // Track tablet breakpoint reactively (only meaningful on native — browser uses
  // phone frame so its viewport is always narrower than the md: threshold).
  const [isTablet, setIsTablet] = useState(
    () => isNative && typeof window !== "undefined" && window.innerWidth >= 768,
  );
  useEffect(() => {
    if (!isNative) return;
    const handler = () => setIsTablet(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [isNative]);

  // Pages that fill the viewport subtract this from 100dvh.
  // 0 on iPad (sidebar nav) — those pages can use the full height.
  const navHeight = isNative && isTablet ? 0 : 90;

  const wardrobeCount = stats?.byCategory
    ? stats.byCategory
        .filter((c: { category: string }) =>
          ["outfits", "beauty", "toiletries", "essentials"].includes(c.category),
        )
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    : undefined;

  const navItems: NavItemDef[] = [
    { href: "/",         label: "Suitcase", icon: Shirt,    badge: wardrobeCount },
    { href: "/generate", label: "Generate", icon: Sparkles  },
    { href: "/saved",    label: "Saved",    icon: Bookmark  },
    { href: "/account",  label: "Settings", icon: Settings  },
  ];

  // ── Native iOS: full-screen, responsive layout ──────────────────────────────
  if (isNative) {
    return (
      <LayoutContext.Provider value={{ navHeight }}>
        {/*
          Outer: flex-row so sidebar + main sit side by side.
          On phone (<768 px) the sidebar is hidden; bottom nav (absolute) fills that role.
        */}
        <div className="h-[100dvh] w-full bg-background flex relative overflow-hidden">

          {/* ── Sidebar — iPad/tablet (md+) only ── */}
          <nav
            className="hidden md:flex flex-col flex-shrink-0 bg-white border-r-[3px] border-black z-40"
            style={{
              width: 80,
              paddingTop:    "max(1.5rem, env(safe-area-inset-top))",
              paddingBottom: "max(1rem,   env(safe-area-inset-bottom))",
              paddingLeft:   "env(safe-area-inset-left)",
            }}
          >
            <ul className="flex flex-col items-center gap-2 w-full px-2">
              {navItems.map((item) => (
                <NavButton key={item.href} item={item} location={location} sidebar />
              ))}
            </ul>
          </nav>

          {/* ── Main content ── */}
          <main
            className="flex-1 overflow-y-auto relative pb-[90px] md:pb-0"
            style={{ paddingRight: "env(safe-area-inset-right)" }}
          >
            {children}
          </main>

          {/* ── Bottom nav — phone only (hidden md+) ── */}
          <nav className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t-[3px] border-black p-3 pb-safe z-[40]">
            <ul className="flex items-center justify-around">
              {navItems.map((item) => (
                <NavButton key={item.href} item={item} location={location} />
              ))}
            </ul>
          </nav>
        </div>
      </LayoutContext.Provider>
    );
  }

  // ── Browser: phone-frame preview (unchanged) ────────────────────────────────
  return (
    <LayoutContext.Provider value={{ navHeight: 90 }}>
      <div className="min-h-[100dvh] w-full bg-[#f8f9fa] flex justify-center lg:py-8 lg:px-4">
        <div className="w-full max-w-md bg-background h-[100dvh] lg:min-h-[850px] lg:h-[850px] lg:border-[6px] lg:border-black lg:rounded-[3rem] lg:shadow-2xl relative overflow-hidden flex flex-col lg:overflow-y-auto">
          <main className="flex-1 overflow-y-auto pb-[90px] relative">
            {children}
          </main>
          <nav className="absolute bottom-0 left-0 right-0 bg-white border-t-[3px] border-black p-3 pb-safe z-[40]">
            <ul className="flex items-center justify-around">
              {navItems.map((item) => (
                <NavButton key={item.href} item={item} location={location} />
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
