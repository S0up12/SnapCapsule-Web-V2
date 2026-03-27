import { render, screen } from "@testing-library/react";

import Dashboard from "./Dashboard";

const useDashboardStats = vi.fn();

vi.mock("../hooks/useDashboardStats", () => ({
  useDashboardStats: () => useDashboardStats(),
}));

vi.mock("../components/dashboard/ImportFlow", () => ({
  default: () => <div>Import Flow</div>,
}));

vi.mock("../components/dashboard/DashboardStats", () => ({
  default: () => <div>Dashboard Stats</div>,
}));

describe("Dashboard", () => {
  it("renders the import flow when there are no imported assets", () => {
    useDashboardStats.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total_assets: 0,
      },
    });

    render(<Dashboard />);

    expect(screen.getByText("Import Flow")).toBeInTheDocument();
  });

  it("renders populated stats when assets exist", () => {
    useDashboardStats.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        total_assets: 3,
      },
    });

    render(<Dashboard />);

    expect(screen.getByText("Dashboard Stats")).toBeInTheDocument();
  });
});
