"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@socialcreator/utils";
import { useCallback } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * Generates the array of page numbers to display, inserting -1 for ellipsis gaps.
 * Shows max 7 page buttons: first, last, current, and siblings around current.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | -1)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | -1)[] = [];

  // Always include first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push(-1); // ellipsis
  }

  // Pages around current
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push(-1); // ellipsis
  }

  // Always include last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const fromItem = (currentPage - 1) * pageSize + 1;
  const toItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      <p className="text-caption text-muted">
        Showing <span className="text-ink font-medium">{fromItem}</span> to{" "}
        <span className="text-ink font-medium">{toItem}</span> of{" "}
        <span className="text-ink font-medium">{totalItems}</span> items
      </p>

      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            currentPage <= 1
              ? "text-muted-soft cursor-not-allowed"
              : "text-muted hover:text-ink hover:bg-surface-strong",
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Number Buttons */}
        {pageNumbers.map((page, index) => {
          if (page === -1) {
            return (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex items-center justify-center w-9 h-9 text-caption text-muted"
              >
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                "inline-flex items-center justify-center w-9 h-9 rounded-lg text-caption font-medium transition-colors",
                page === currentPage
                  ? "bg-ink text-on-primary"
                  : "text-muted hover:text-ink hover:bg-surface-strong",
              )}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            currentPage >= totalPages
              ? "text-muted-soft cursor-not-allowed"
              : "text-muted hover:text-ink hover:bg-surface-strong",
          )}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-caption text-muted hidden sm:block">
        Page {currentPage} of {totalPages}
      </p>
    </div>
  );
}
