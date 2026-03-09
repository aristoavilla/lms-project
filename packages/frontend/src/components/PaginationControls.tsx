interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
}: Props) {
  if (totalItems <= pageSize || totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <p className="muted-line">
        Showing {(currentPage - 1) * pageSize + 1}-
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      <div className="button-row">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="pagination-page">
          Page {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
