import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PopoverSelect from "./PopoverSelect";

describe("PopoverSelect", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 420,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
  });

  it("renders the menu in a portal and flips upward when space below is limited", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <PopoverSelect
        label="Grid Size"
        value="medium"
        onChange={onChange}
        options={[
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /grid size/i });
    trigger.getBoundingClientRect = () =>
      ({
        left: 24,
        top: 360,
        right: 204,
        bottom: 400,
        width: 180,
        height: 40,
      }) as DOMRect;

    fireEvent.click(trigger);

    const listbox = await screen.findByRole("listbox", { name: "Grid Size" });
    expect(container).not.toContainElement(listbox);
    expect(listbox.style.top).toBeTruthy();
    expect(Number.parseFloat(listbox.style.top)).toBeLessThan(360);

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(onChange).toHaveBeenCalledWith("large");
  });

  it("closes when clicking outside the trigger and menu", async () => {
    render(
      <div>
        <button type="button">Outside</button>
        <PopoverSelect
          label="Sort"
          value="newest"
          onChange={vi.fn()}
          options={[
            { value: "newest", label: "Newest First" },
            { value: "oldest", label: "Oldest First" },
          ]}
        />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: /sort/i });
    trigger.getBoundingClientRect = () =>
      ({
        left: 24,
        top: 120,
        right: 204,
        bottom: 160,
        width: 180,
        height: 40,
      }) as DOMRect;

    fireEvent.click(trigger);
    await screen.findByRole("listbox", { name: "Sort" });

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Sort" })).not.toBeInTheDocument();
    });
  });
});
