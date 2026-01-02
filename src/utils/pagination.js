const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const parseNumber = (value) => {
  if (Array.isArray(value)) {
    return parseNumber(value[0])
  }
  if (value === undefined || value === null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export const normalizePagination = (query = {}) => {
  const rawPage = parseNumber(query.page)
  const rawPageSize =
    parseNumber(query.pageSize) ??
    parseNumber(query.limit) ??
    parseNumber(query.perPage)

  const page = rawPage && rawPage > 0 ? rawPage : 1
  const pageSize =
    rawPageSize && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

  return { page, pageSize }
}

export const buildPagination = ({ page, pageSize, total }) => ({
  page,
  pageSize,
  total,
  totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
})
