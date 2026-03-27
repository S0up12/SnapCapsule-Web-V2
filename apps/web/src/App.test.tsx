import { Outlet } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";

import App from "./App";

vi.mock("./components/Layout", () => ({
  default: function MockLayout() {
    return <Outlet />;
  },
}));

vi.mock("./views/Dashboard", () => ({
  default: () => <div>Dashboard View</div>,
}));

vi.mock("./views/Profile", () => ({
  default: () => <div>Profile View</div>,
}));

vi.mock("./views/Stories", () => ({
  default: () => <div>Stories View</div>,
}));

vi.mock("./views/Chats", () => ({
  default: () => <div>Chats View</div>,
}));

vi.mock("./views/Memories", () => ({
  default: () => <div>Memories View</div>,
}));

vi.mock("./views/Settings", () => ({
  default: () => <div>Settings View</div>,
}));

const useStoriesWorkspaceVisibility = vi.fn();

vi.mock("./features", () => ({
  useStoriesWorkspaceVisibility: () => useStoriesWorkspaceVisibility(),
}));

describe("App routing", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("redirects hidden stories route back to the dashboard", async () => {
    useStoriesWorkspaceVisibility.mockReturnValue({
      isVisible: false,
      isLoading: false,
    });
    window.history.pushState({}, "", "/stories");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Dashboard View")).toBeInTheDocument();
    });
    expect(screen.queryByText("Stories View")).not.toBeInTheDocument();
  });
});
