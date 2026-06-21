import React from "react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { render } from "./test-utils";

describe("@socialcreator/ui - DropdownMenu", () => {
  it("should render the trigger element", () => {
    const { container, cleanup } = render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    // Trigger should be visible
    expect(container.textContent).toContain("Menu");
    cleanup();
  });

  it("should render content in body when open", () => {
    const { cleanup } = render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Visible Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    // Radix Portal renders content into document.body
    expect(document.body.textContent).toContain("Visible Item");
    cleanup();
  });

  it("should render multiple menu items in body", () => {
    const { cleanup } = render(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Delete</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(document.body.textContent).toContain("Edit");
    expect(document.body.textContent).toContain("Delete");
    expect(document.body.textContent).toContain("Settings");
    cleanup();
  });
});
