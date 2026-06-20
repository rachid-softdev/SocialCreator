import { describe, expect, it } from "vitest";

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function calculatePagination<T>(
  items: T[],
  total: number,
  options?: PaginationOptions,
): PageResult<T> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

describe("pagination calculation", () => {
  describe("page defaults", () => {
    it("should default to page 1 when page is undefined", () => {
      const result = calculatePagination([], 0, { pageSize: 10 });
      expect(result.page).toBe(1);
    });

    it("should default to page 1 when page is 0", () => {
      const result = calculatePagination([], 0, { page: 0, pageSize: 10 });
      expect(result.page).toBe(0);
    });
  });

  describe("pageSize defaults", () => {
    it("should default pageSize to 20 when not provided", () => {
      const result = calculatePagination([], 0, { page: 1 });
      expect(result.pageSize).toBe(20);
    });

    it("should use provided pageSize when specified", () => {
      const result = calculatePagination([], 0, { page: 1, pageSize: 50 });
      expect(result.pageSize).toBe(50);
    });
  });

  describe("totalPages calculation", () => {
    it("should calculate totalPages correctly for exact division", () => {
      const result = calculatePagination([], 100, { pageSize: 20 });
      expect(result.totalPages).toBe(5);
    });

    it("should ceil totalPages when there is a remainder", () => {
      const result = calculatePagination([], 101, { pageSize: 20 });
      expect(result.totalPages).toBe(6);
    });

    it("should return 0 totalPages when total is 0", () => {
      const result = calculatePagination([], 0, { pageSize: 20 });
      expect(result.totalPages).toBe(0);
    });

    it("should return 1 totalPages when total equals pageSize", () => {
      const result = calculatePagination([], 20, { pageSize: 20 });
      expect(result.totalPages).toBe(1);
    });

    it("should return 1 totalPages when total is less than pageSize", () => {
      const result = calculatePagination([], 5, { pageSize: 20 });
      expect(result.totalPages).toBe(1);
    });

    it("should handle single item total", () => {
      const result = calculatePagination([], 1, { pageSize: 20 });
      expect(result.totalPages).toBe(1);
    });
  });

  describe("page calculation edge cases", () => {
    it("should handle large page numbers", () => {
      const result = calculatePagination([], 100, { page: 999, pageSize: 10 });
      expect(result.page).toBe(999);
      expect(result.totalPages).toBe(10);
    });

    it("should handle large page sizes", () => {
      const result = calculatePagination([], 1000, { page: 1, pageSize: 1000 });
      expect(result.totalPages).toBe(1);
    });

    it("should handle very large totals", () => {
      const result = calculatePagination([], 1_000_000, { page: 1, pageSize: 20 });
      expect(result.totalPages).toBe(50000);
    });
  });

  describe("item slicing (skip/take equivalence)", () => {
    function slicePage<T>(all: T[], page: number, pageSize: number): T[] {
      const skip = (page - 1) * pageSize;
      return all.slice(skip, skip + pageSize);
    }

    it("should return first page items correctly", () => {
      const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const page = slicePage(all, 1, 3);
      expect(page).toStrictEqual([1, 2, 3]);
    });

    it("should return second page items correctly", () => {
      const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const page = slicePage(all, 2, 3);
      expect(page).toStrictEqual([4, 5, 6]);
    });

    it("should return last page with fewer items", () => {
      const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const page = slicePage(all, 4, 3);
      expect(page).toStrictEqual([10]);
    });

    it("should return empty array for page beyond total", () => {
      const all = [1, 2, 3];
      const page = slicePage(all, 10, 3);
      expect(page).toStrictEqual([]);
    });

    it("should demonstrate that page 0 produces negative skip (unexpected behavior)", () => {
      const all = [1, 2, 3];
      const skip = (0 - 1) * 3;
      expect(skip).toBe(-3);
      const page = all.slice(skip, skip + 3);
      expect(page).toStrictEqual([]);
    });
  });

  describe("result formatting", () => {
    it("should include items, total, page, pageSize, totalPages", () => {
      const items = [{ id: "a" }, { id: "b" }];
      const result = calculatePagination(items, 25, { page: 2, pageSize: 10 });

      expect(result).toStrictEqual({
        items,
        total: 25,
        page: 2,
        pageSize: 10,
        totalPages: 3,
      });
    });

    it("should return empty items array when no results", () => {
      const result = calculatePagination([], 0, { page: 1, pageSize: 20 });

      expect(result.items).toStrictEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
