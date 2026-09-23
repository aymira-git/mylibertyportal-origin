import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManagerCashSummary } from "./ManagerCashSummary";

describe("ManagerCashSummary", () => {
  it("renders correctly with zero payments", () => {
    render(<ManagerCashSummary branch="Kota Gorontalo" payments={[]} />);
    expect(screen.getByText("Today's Cash Drawer & Intake")).toBeDefined();
    expect(screen.getByText("Kota Gorontalo")).toBeDefined();
  });

  it("displays formatted totals based on payment methods", () => {
    const mockPayments = [
      { amount: 150000, method: "cash" },
      { amount: 300000, method: "transfer" },
      { amount: 75000, method: "qris" },
    ];
    render(<ManagerCashSummary branch="Kota Gorontalo" payments={mockPayments} />);
    expect(screen.getByText("3 txns")).toBeDefined();
  });
});
