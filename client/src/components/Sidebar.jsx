import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Briefcase, Files, LogOut, Menu, Moon, Send, Sun, User as UserIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { Avatar } from "./Avatar.jsx";

const NAV_ITEMS = [
  { to: "/applications", label: "Applications", icon: Briefcase, end: false },
  { to: "/resumes", label: "Master Resumes", icon: Files, end: false },
  { to: "/outreach", label: "Outreach Tracker", icon: Send, end: false },
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

// Single clickable footer element — avatar + name — that opens a dropdown with
// Profile / theme toggle / Log out, replacing the old always-visible email row
// + standalone theme button.
function AccountMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-accent"
        >
          <Avatar fullName={user?.fullName} />
          <span className="truncate text-sm text-muted-foreground" title={user?.fullName || user?.email}>
            {user?.fullName || user?.email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserIcon className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          ResumeStitch AI
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
          ResumeStitch AI
        </div>
        <NavLinks />
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <AccountMenu />
        </div>
      </aside>

      <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogContent className="top-20 translate-y-0 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
          </DialogHeader>
          <NavLinks onNavigate={() => setIsMenuOpen(false)} />
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <AccountMenu />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
