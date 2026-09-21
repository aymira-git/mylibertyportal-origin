import { BookOpen, Layers, LayoutDashboard, Sparkles } from "lucide-react";
import { describe, expect, it } from "vitest";
import { getCleanLabel, getTabCategory, getTabIcon, groupTabsByCategory } from "./tabUtils.js";

describe("getCleanLabel", () => {
  it("removes leading emoji and symbols", () => {
    expect(getCleanLabel("🏠 Overview")).toBe("Overview");
    expect(getCleanLabel("✨ AI Assistant")).toBe("AI Assistant");
  });

  it("leaves normal labels alone, and never returns an empty label", () => {
    expect(getCleanLabel("Overview")).toBe("Overview");
    expect(getCleanLabel("")).toBe("");
    expect(getCleanLabel("🏠")).toBe("🏠");
  });
});

describe("getTabCategory", () => {
  it.each([
    ["overview", "Main"],
    ["classes", "Academic"],
    ["kiosk", "Academic"],
    ["students", "Academic"],
    ["progress", "Academic"],
    ["staff", "Operations"],
    ["finance", "Operations"],
    ["invites", "Operations"],
    ["tasks", "Operations"],
    ["reports", "System"],
    ["aiAssistant", "System"],
    ["settings", "System"],
  ])("puts tab id '%s' under %s", (id, category) => {
    expect(getTabCategory({ id })).toBe(category);
  });

  it("uses the label when the id is unknown", () => {
    expect(getTabCategory({ id: "x", label: "Staff Directives" })).toBe("Operations");
    expect(getTabCategory({ id: "x", label: "Class Photos" })).toBe("Academic");
  });

  it("lets an explicit category win, and defaults to Operations", () => {
    expect(getTabCategory({ id: "reports", category: "Custom" })).toBe("Custom");
    expect(getTabCategory({ id: "zzz", label: "Something" })).toBe("Operations");
  });
});

describe("getTabIcon", () => {
  it("prefers an icon given on the tab", () => {
    const Custom = () => null;
    expect(getTabIcon({ id: "overview", icon: Custom })).toBe(Custom);
  });

  it("maps known ids and falls back to a generic icon", () => {
    expect(getTabIcon({ id: "overview" })).toBe(LayoutDashboard);
    expect(getTabIcon({ id: "classes" })).toBe(BookOpen);
    expect(getTabIcon({ id: "zzz", label: "Something" })).toBe(Layers);
  });

  // Latent, open to debate: the last label rule uses includes("ai"), which also
  // matches ordinary words like "Available". No current tab reaches this rule
  // (they all have ids that match first), but a future one could.
  it.fails("does not give a tab the AI sparkle just because its label contains 'ai'", () => {
    expect(getTabIcon({ id: "batches", label: "Available Batches" })).not.toBe(Sparkles);
  });
});

describe("groupTabsByCategory", () => {
  const tabs = [
    { id: "reports", label: "Reports" },
    { id: "students", label: "Students" },
    { id: "overview", label: "Overview" },
    { id: "addUser", label: "Add / Edit User", hidden: true },
    { id: "staff", label: "Staff" },
    { id: "x", label: "Odd", category: "Extra" },
  ];

  it("orders groups Main, Academic, Operations, System, then custom groups", () => {
    expect(groupTabsByCategory(tabs).map(([cat]) => cat)).toEqual(["Main", "Academic", "Operations", "System", "Extra"]);
  });

  it("leaves hidden tabs out", () => {
    const all = groupTabsByCategory(tabs).flatMap(([, list]) => list.map((t) => t.id));
    expect(all).not.toContain("addUser");
    expect(all).toHaveLength(5);
  });

  it("returns an empty list when there are no visible tabs", () => {
    expect(groupTabsByCategory([{ id: "a", hidden: true }])).toEqual([]);
  });
});
