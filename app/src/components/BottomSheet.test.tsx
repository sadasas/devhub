import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "./BottomSheet";

describe("BottomSheet", () => {
  it("renders nothing when closed", () => {
    render(
      <BottomSheet open={false} title="Sort" onClose={() => {}}>
        body
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders title, body and sticky footer when open", () => {
    render(
      <BottomSheet
        open
        title="Sort"
        onClose={() => {}}
        footer={<button type="button">Apply</button>}
      >
        <p>sheet body</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Sort")).toBeTruthy();
    expect(screen.getByText("sheet body")).toBeTruthy();
    const footer = screen.getByText("Apply").closest("footer");
    expect(footer?.className).toContain("sheet-footer-sticky");
  });

  it("calls onClose from the header close button", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open title="Sort" onClose={onClose}>
        body
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open title="Sort" onClose={onClose}>
        body
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open title="Sort" onClose={onClose}>
        body
      </BottomSheet>,
    );
    const backdrop = document.querySelector(".sheet-backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("swallows the compat click after backdrop dismiss so background stays untouched", () => {
    const behind = vi.fn();
    render(
      <>
        <button type="button" onClick={behind}>
          Behind
        </button>
        <BottomSheet open title="Sort" onClose={() => {}}>
          body
        </BottomSheet>
      </>,
    );
    const backdrop = document.querySelector(".sheet-backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.mouseDown(backdrop!);

    const btn = screen.getByRole("button", { name: "Behind" });
    fireEvent.click(btn);
    expect(behind).not.toHaveBeenCalled();

    // One-shot: the next click passes through normally.
    fireEvent.click(btn);
    expect(behind).toHaveBeenCalledTimes(1);
  });

  it("hides the handle when withHandle is false", () => {
    render(
      <BottomSheet open title="Sort" onClose={() => {}} withHandle={false}>
        body
      </BottomSheet>,
    );
    expect(document.querySelector(".sheet-handle")).toBeNull();
  });

  it("renders without a backdrop when withOverlay is false", () => {
    render(
      <BottomSheet open title="Sort" onClose={() => {}} withOverlay={false}>
        body
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".sheet-backdrop")).toBeNull();
  });

  it("hides the visual header but keeps an sr-only title when hideHeader is true", () => {
    render(
      <BottomSheet open title="Project actions" onClose={() => {}} hideHeader>
        body
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".sheet-header")).toBeNull();
    const title = screen.getByText("Project actions");
    expect(title.tagName).toBe("H2");
    expect(title.className).toContain("sr-only");
  });
});
