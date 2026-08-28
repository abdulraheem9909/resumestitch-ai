import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Briefcase, Files, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle.jsx";

const NAV_ITEMS = [
  { to: "/applications", label: "Applications", icon: Briefcase, end: false },
  { to: "/resumes", label: "Master Resumes", icon: Files, end: false },
];

function NavLinks({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1.5">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              buttonVariants({ variant: isActive ? "default" : "ghost", size: "lg" }),
              "w-full justify-start gap-3 text-base font-medium"
            )
          }
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile/tablet top bar — replaces the side rail below the laptop breakpoint. A fixed-height
          flex sibling of the independently-scrolling <main>, not itself sticky — main owns the only
          scroll container now, which is what keeps the in-page sticky header from fighting this bar
          for position on scroll. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <span className="font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Job Application Agent
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setIsMenuOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Desktop side rail */}
      <aside className="hidden h-svh w-68 shrink-0 flex-col border-r border-border bg-card p-6 md:flex">
        <div className="mb-8 px-3 font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Job Application Agent
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-border pt-4">
          <ThemeToggle />
        </div>
      </aside>

      <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogContent className="top-20 translate-y-0 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
          </DialogHeader>
          <NavLinks onNavigate={() => setIsMenuOpen(false)} />
          <div className="border-t border-border pt-4">
            <ThemeToggle />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
