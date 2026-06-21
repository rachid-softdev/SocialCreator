import React from "react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { render } from "./test-utils";

describe("@socialcreator/ui - Dialog", () => {
  it("should render dialog trigger", () => {
    const { container, cleanup } = render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>,
    );
    // Trigger should be rendered
    expect(container.textContent).toContain("Open");
    cleanup();
  });

  it("should render content via body when open is true", () => {
    const { cleanup } = render(
      <Dialog open={true}>
        <DialogContent>
          <p>Visible content</p>
        </DialogContent>
      </Dialog>,
    );
    // Radix Portal renders content into document.body
    expect(document.body.textContent).toContain("Visible content");
    cleanup();
  });

  it("should render DialogHeader and DialogTitle inside body", () => {
    const { cleanup } = render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>My Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(document.body.textContent).toContain("My Title");
    cleanup();
  });

  it("should render DialogFooter inside body", () => {
    const { cleanup } = render(
      <Dialog open={true}>
        <DialogContent>
          <DialogFooter>
            <button type="button">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(document.body.textContent).toContain("Save");
    cleanup();
  });

  it("should render DialogDescription inside body", () => {
    const { cleanup } = render(
      <Dialog open={true}>
        <DialogContent>
          <DialogDescription>This is a description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(document.body.textContent).toContain("This is a description");
    cleanup();
  });

  it("should render a close button with sr-only text", () => {
    const { cleanup } = render(
      <Dialog open={true}>
        <DialogContent>Content</DialogContent>
      </Dialog>,
    );
    expect(document.body.textContent).toContain("Close");
    cleanup();
  });
});
