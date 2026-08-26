import { NavLink } from "react-router-dom";
import { Briefcase, Files, ListChecks } from "lucide-react";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/bullets", label: "Resume Bullets", icon: ListChecks, end: true },
  { to: "/resumes", label: "Master Resumes", icon: Files, end: false },
  { to: "/applications", label: "Applications", icon: Briefcase, end: true },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-mark">Job Application Agent</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
