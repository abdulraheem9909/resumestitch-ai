import { NavLink } from "react-router-dom";
import { Briefcase, Files, ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/bullets", label: "Resume Bullets", icon: ListChecks, end: true },
  { to: "/resumes", label: "Master Resumes", icon: Files, end: false },
  { to: "/applications", label: "Applications", icon: Briefcase, end: true },
];

export default function Sidebar() {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card p-4 md:h-svh md:w-62 md:border-r md:border-b-0 md:p-6">
      <div className="mb-7 px-3 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Job Application Agent
      </div>
      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                buttonVariants({ variant: isActive ? "default" : "ghost" }),
                "w-full justify-start gap-2.5 text-sm font-medium"
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
