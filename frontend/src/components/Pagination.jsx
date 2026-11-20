import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, pages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="pagination">
      <span className="muted">
        Showing {from}-{to} of {total}
      </span>
      <div className="pagination-buttons">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="page-indicator">
          Page {page} of {pages}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
