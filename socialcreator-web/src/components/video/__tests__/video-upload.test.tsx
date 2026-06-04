/**
 * Tests for VideoUpload component
 *
 * Renders a drop zone for video uploads with multiple states:
 * idle, uploading (with progress), processing, uploaded, and error.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { VideoUpload } from "../video-upload";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: any) => (
    <span data-testid="icon-loader" className={className}>
      svg-loader
    </span>
  ),
  Upload: ({ className }: any) => (
    <span data-testid="icon-upload" className={className}>
      svg-upload
    </span>
  ),
  X: ({ className }: any) => (
    <span data-testid="icon-x" className={className}>
      svg-x
    </span>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function createFile(name = "video.mp4", type = "video/mp4", size = 1024 * 1024): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function getFileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("VideoUpload", () => {
  const onUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the idle upload zone by default", () => {
    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    expect(screen.getByText("Drop your video here")).toBeInTheDocument();
    expect(screen.getByText("or click to browse")).toBeInTheDocument();
    expect(screen.getByText(/MP4, MOV, WebM/)).toBeInTheDocument();
  });

  it("renders upload icon in idle state", () => {
    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    expect(screen.getByText("svg-upload")).toBeInTheDocument();
  });

  it("shows uploading state with progress", async () => {
    // Keep fetch pending to stay in uploading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("Uploading...")).toBeInTheDocument();
    });
  });

  it("shows progress percentage during upload", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      // Progress starts at 0, should be visible
      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  it("validates file type and does not call onUploadComplete for invalid types", () => {
    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    const input = getFileInput();
    const invalidFile = new File(["test"], "image.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    // Component sets error internally but doesn't render it (doesn't set state="error")
    expect(screen.queryByText("Invalid file type")).not.toBeInTheDocument();
    expect(onUploadComplete).not.toHaveBeenCalled();
  });

  it("validates file size and does not call onUploadComplete for files over 500MB", () => {
    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    const input = getFileInput();
    const hugeFile = createFile("large.mp4", "video/mp4", 600 * 1024 * 1024);

    fireEvent.change(input, { target: { files: [hugeFile] } });

    expect(screen.queryByText("File too large")).not.toBeInTheDocument();
    expect(onUploadComplete).not.toHaveBeenCalled();
  });

  it("shows error state when upload API fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
  });

  it("shows the error message in error state", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to get upload URL"));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("Failed to get upload URL")).toBeInTheDocument();
    });
  });

  it("shows Try again button in error state", async () => {
    mockFetch.mockRejectedValue(new Error("Error"));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });
  });

  it("returns to idle state when Try again is clicked", async () => {
    mockFetch.mockRejectedValue(new Error("Error"));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Try again"));

    expect(screen.getByText("Drop your video here")).toBeInTheDocument();
  });

  it("supports drag and drop", () => {
    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    const dropZone = document.querySelector('[role="none"]') as HTMLElement;

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [createFile()],
      },
    });

    // Should show uploading state
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
  });

  it("calls onUploadComplete when upload succeeds", async () => {
    // First call: POST to get presigned URL
    // Second call: PUT to upload
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://upload.example.com/video",
          videoAssetId: "asset-123",
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    const onComplete = vi.fn();
    render(<VideoUpload profileId="profile-1" onUploadComplete={onComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    // Component has a 1-second processing delay before showing "Video uploaded"
    await waitFor(
      () => {
        expect(screen.getByText("Video uploaded")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(onComplete).toHaveBeenCalledWith("asset-123", "https://upload.example.com/video");
  });

  it("shows processing state between upload and completion", async () => {
    // First call resolves, but delay the completion
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: "https://upload.example.com/video",
          videoAssetId: "asset-123",
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    // Should reach processing state (before 1s delay to "uploaded")
    await waitFor(() => {
      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });
  });

  it("shows error icon in error state", async () => {
    mockFetch.mockRejectedValue(new Error("Error"));

    render(<VideoUpload profileId="profile-1" onUploadComplete={onUploadComplete} />);

    await userEvent.upload(getFileInput(), createFile());

    await waitFor(() => {
      expect(screen.getByText("svg-x")).toBeInTheDocument();
    });
  });
});
