"use client";

import { useMemo, useState } from 'react';

export default function usePagination(records = [], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((records ? records.length : 0) / pageSize)), [records, pageSize]);
  const pageStartIndex = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const pageRecords = useMemo(() => (records || []).slice(pageStartIndex, pageStartIndex + pageSize), [records, pageStartIndex, pageSize]);

  const reset = (keepPage = false) => {
    if (!keepPage) setPage(1);
  };

  const setPageSizeAndReset = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    page,
    setPage,
    pageSize,
    setPageSize: setPageSizeAndReset,
    totalPages,
    pageRecords,
    reset,
  };
}
