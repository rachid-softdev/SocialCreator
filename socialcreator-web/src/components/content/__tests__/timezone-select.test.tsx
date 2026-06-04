/**
 * Tests for TimezoneSelect component.
 *
 * Renders dropdown with timezone options grouped by region.
 * Fires onChange when a different timezone is selected.
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { TimezoneSelect } from "../timezone-select";

vi.mock("lucide-react", () => ({
  Globe: "svg-globe",
}));

// NOTE: jsdom supports Intl.supportedValuesOf("timeZone") in recent V8,
// so the component's optgroup rendering depends on the runtime environment.
// We test against whatever the runtime provides.

describe("TimezoneSelect", () => {
  it("renders a select element with timezone options", () => {
    render(<TimezoneSelect value="America/New_York" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("renders common timezone options like America/New_York", () => {
    render(<TimezoneSelect value="America/New_York" onChange={vi.fn()} />);
    // The option text replaces underscores with spaces
    expect(screen.getByText("America/New York")).toBeInTheDocument();
  });

  it("renders options inside <optgroup> elements grouped by region", () => {
    const { container } = render(<TimezoneSelect value="America/New_York" onChange={vi.fn()} />);
    const optgroups = container.querySelectorAll("optgroup");
    expect(optgroups.length).toBeGreaterThanOrEqual(4);
    // Verify at least common regions exist
    const labels = Array.from(optgroups).map((og) => og.getAttribute("label"));
    expect(labels).toContain("America");
    expect(labels).toContain("Europe");
    expect(labels).toContain("Asia");
  });

  it("sets the current value as selected", () => {
    render(<TimezoneSelect value="America/New_York" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("America/New_York");
  });

  it("fires onChange when a different timezone is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimezoneSelect value="America/New_York" onChange={onChange} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "Europe/London");

    expect(onChange).toHaveBeenCalledWith("Europe/London");
  });

  it("displays the Globe icon", () => {
    const { container } = render(<TimezoneSelect value="America/New_York" onChange={vi.fn()} />);
    expect(container.innerHTML).toContain("svg-globe");
  });

  it("renders Asia timezone region with options", () => {
    const { container } = render(<TimezoneSelect value="Asia/Tokyo" onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Asia/Tokyo");
    // Verify there's an Asia optgroup with Tokyo option
    const asiaOptgroup = Array.from(container.querySelectorAll("optgroup")).find(
      (og) => og.getAttribute("label") === "Asia",
    );
    expect(asiaOptgroup).toBeTruthy();
    expect(asiaOptgroup?.querySelector('option[value="Asia/Tokyo"]')).toBeInTheDocument();
  });
});
