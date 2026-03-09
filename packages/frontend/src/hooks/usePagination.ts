import { useEffect, useMemo, useState } from "react";

export function usePagination<T>(
  items: T[],
  pageSize = 10,
  resetKey?: string | number | boolean | null,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    pageItems,
    pageSize,
    totalItems: items.length,
  };
}
