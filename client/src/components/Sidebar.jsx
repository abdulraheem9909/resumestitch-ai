import { NavLink } from "react-router-dom";
import { Briefcase, Files, ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle.jsx";

const NAV_ITEMS = [
  { to: "/bullets", label: "Resume Bullets", icon: ListChecks, end: true },
  { to: "/resumes", label: "Master Resumes", icon: Files, end: false },
  { to: "/applications", label: "Applications", icon: Briefcase, end: true },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 z-10 flex max-h-svh w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-card p-4 md:h-svh md:w-68 md:border-r md:border-b-0 md:p-6">
      <div className="mb-8 px-3 font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Job Application Agent
      </div>
      <nav className="flex flex-row flex-wrap gap-1.5 md:flex-col">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
      <div className="mt-auto border-t border-border pt-4">
        <ThemeToggle />
      </div>
    </aside>
  );
}
