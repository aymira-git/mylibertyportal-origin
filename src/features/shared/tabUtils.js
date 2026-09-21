import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  ScanLine,
  Users,
  CreditCard,
  UserPlus,
  Mail,
  BarChart3,
  CheckSquare,
  Sparkles,
  ClipboardCheck,
  FolderOpen,
  Layers,
  Settings,
  Megaphone,
} from "lucide-react";

export function getCleanLabel(label = "") {
  return label.replace(/^(\p{Extended_Pictographic}|\p{Emoji}|[^\w\s])+\s*/u, "").trim() || label;
}

export function getTabIcon(tab) {
  if (tab.icon) return tab.icon;
  const id = (tab.id || "").toLowerCase();
  const label = (tab.label || "").toLowerCase();

  if (id === "overview") return LayoutDashboard;
  if (id === "progress" || label.includes("progress")) return ClipboardCheck;
  if (id === "students" || label.includes("student")) return GraduationCap;
  if (id === "classes" || label.includes("class")) return BookOpen;
  if (
    id === "kiosk" ||
    id === "attendance" ||
    label.includes("attendance") ||
    label.includes("kiosk")
  ) {
    return ScanLine;
  }
  if (id === "materials" || label.includes("material")) return FolderOpen;
  if (id === "directory" || id === "staff" || label.includes("staff")) return Users;
  if (id === "finance" || label.includes("finance") || label.includes("payment")) return CreditCard;
  if (id === "applications" || label.includes("application")) return UserPlus;
  if (id === "invites" || label.includes("invite")) return Mail;
  if (id === "campaigns" || label.includes("marketing")) return Megaphone;
  if (id === "tasks" || id === "misc" || label.includes("task") || label.includes("directive")) {
    return CheckSquare;
  }
  if (id === "reports" || label.includes("report")) return BarChart3;
  if (id === "ai" || id === "aiassistant" || /\bai\b/i.test(label)) return Sparkles;
  if (id === "settings" || label.includes("setting")) return Settings;

  return Layers;
}

export function getTabCategory(tab) {
  if (tab.category) return tab.category;
  const id = (tab.id || "").toLowerCase();
  const label = (tab.label || "").toLowerCase();

  if (id === "overview") return "Main";

  // Academic: Classes, Attendance, Students, Progress, Materials
  if (
    ["classes", "kiosk", "attendance", "students", "progress", "materials"].includes(id) ||
    label.includes("class") ||
    label.includes("attendance") ||
    label.includes("student") ||
    label.includes("material")
  ) {
    return "Academic";
  }

  // Operations: Staff, Finance, Marketing, Applications, Invites, Tasks
  if (
    [
      "directory",
      "staff",
      "finance",
      "applications",
      "invites",
      "tasks",
      "misc",
      "campaigns",
    ].includes(id) ||
    label.includes("staff") ||
    label.includes("finance") ||
    label.includes("application") ||
    label.includes("invite") ||
    label.includes("task") ||
    label.includes("directive")
  ) {
    return "Operations";
  }

  // System: Reports, Settings, AI Assistant
  if (
    ["reports", "ai", "aiassistant", "settings"].includes(id) ||
    label.includes("report") ||
    /\bai\b/i.test(label) ||
    label.includes("setting")
  ) {
    return "System";
  }

  return "Operations";
}

const CATEGORY_ORDER = ["Main", "Academic", "Operations", "System"];

export function groupTabsByCategory(tabs) {
  const visible = tabs.filter((t) => !t.hidden);
  const groups = new Map();

  visible.forEach((tab) => {
    const cat = getTabCategory(tab);
    if (!groups.has(cat)) {
      groups.set(cat, []);
    }
    groups.get(cat).push(tab);
  });

  const sorted = [];
  CATEGORY_ORDER.forEach((cat) => {
    if (groups.has(cat)) {
      sorted.push([cat, groups.get(cat)]);
      groups.delete(cat);
    }
  });

  groups.forEach((tabsInCat, cat) => {
    sorted.push([cat, tabsInCat]);
  });

  return sorted;
}
