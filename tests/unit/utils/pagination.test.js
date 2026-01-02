import {
  buildPagination,
  normalizePagination,
} from "../../../src/utils/pagination.js";

describe("normalizePagination", () => {
  it("uses defaults when no query is provided", () => {
    expect(normalizePagination()).toEqual({ page: 1, pageSize: 50 });
  });

  it("accepts page and pageSize from query", () => {
    expect(normalizePagination({ page: "3", pageSize: "20" })).toEqual({
      page: 3,
      pageSize: 20,
    });
  });

  it("accepts limit and perPage aliases", () => {
    expect(normalizePagination({ limit: "12" })).toEqual({
      page: 1,
      pageSize: 12,
    });
    expect(normalizePagination({ perPage: "7" })).toEqual({
      page: 1,
      pageSize: 7,
    });
  });

  it("caps the page size to the maximum", () => {
    expect(normalizePagination({ pageSize: "500" })).toEqual({
      page: 1,
      pageSize: 200,
    });
  });

  it("uses the first value when arrays are provided", () => {
    expect(
      normalizePagination({ page: ["2", "3"], pageSize: ["9", "4"] }),
    ).toEqual({
      page: 2,
      pageSize: 9,
    });
  });
});

describe("buildPagination", () => {
  it("computes totalPages based on total and pageSize", () => {
    expect(buildPagination({ page: 1, pageSize: 50, total: 101 })).toEqual({
      page: 1,
      pageSize: 50,
      total: 101,
      totalPages: 3,
    });
  });

  it("returns zero totalPages when there are no results", () => {
    expect(buildPagination({ page: 1, pageSize: 50, total: 0 })).toEqual({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    });
  });
});
