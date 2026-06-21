import React from "react";
import { describe, expect, it } from "vitest";
import { VideoCard } from "../video-card";
import { render } from "./test-utils";

describe("@socialcreator/ui - VideoCard", () => {
  it("should render status and date", () => {
    const { container, cleanup } = render(
      <VideoCard status="READY" createdAt="2025-06-15T10:00:00Z" />,
    );
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("Jun 15");
    cleanup();
  });

  it("should render duration when provided", () => {
    const { container, cleanup } = render(
      <VideoCard status="READY" createdAt="2025-06-15T10:00:00Z" duration={125} />,
    );
    // 125 seconds = 2:05
    expect(container.textContent).toContain("2:05");
    cleanup();
  });

  it("should render each status label correctly", () => {
    const statuses: Record<string, string> = {
      UPLOADING: "Uploading",
      UPLOADED: "Uploaded",
      TRANSCRIBING: "Transcribing",
      TRANSCRIBED: "Transcribed",
      SEGMENTS_IDENTIFIED: "Segments",
      CLIPS_CREATED: "Clips Ready",
      PROCESSING: "Processing",
      READY: "Ready",
      ERROR: "Error",
    };

    for (const [status, label] of Object.entries(statuses)) {
      const { container, cleanup } = render(
        <VideoCard status={status} createdAt="2025-06-15T10:00:00Z" />,
      );
      expect(container.textContent).toContain(label);
      cleanup();
    }
  });

  it("should render fallback label for unknown status", () => {
    const { container, cleanup } = render(
      <VideoCard status="UNKNOWN_STATUS" createdAt="2025-06-15T10:00:00Z" />,
    );
    expect(container.textContent).toContain("UNKNOWN_STATUS");
    cleanup();
  });

  it("should call onClick when clicked", () => {
    let clicked = false;
    const { container, cleanup } = render(
      <VideoCard
        status="READY"
        createdAt="2025-06-15T10:00:00Z"
        onClick={() => {
          clicked = true;
        }}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    card.click();
    expect(clicked).toBe(true);
    cleanup();
  });

  it("should apply custom className", () => {
    const { container, cleanup } = render(
      <VideoCard status="READY" createdAt="2025-06-15T10:00:00Z" className="my-card" />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("my-card");
    cleanup();
  });
});
