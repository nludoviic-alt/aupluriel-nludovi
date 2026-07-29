import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Zap, MessageSquare, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  {
    title: "Accueil",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Auto-Trader",
    url: "/ia-trading",
    icon: Zap,
  },
  {
    title: "Messagerie",
    url: "/messagerie",
    icon: MessageSquare,
  },
  {
    title: "Historique",
    url: "/historique",
    icon: BarChart3,
  },
];

export function AppMobileBottomBar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/60 bg-background/90 backdrop-blur-xl px-2 py-1.5 shadow-lg">
      <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
        {mobileNavItems.map((item) => {
          const active = isActive(item.url);
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1.5 px-1 transition-all duration-200 relative",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />}
              <Icon className={cn("h-4 w-4 transition-transform", active && "scale-110")} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider leading-none">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
