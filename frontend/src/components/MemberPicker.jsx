import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import useDebounce from '../hooks/useDebounce';
import * as memberService from '../services/memberService';

/** Searchable member selector (queries the API so it scales beyond a few hundred members). */
export default function MemberPicker({ value, onSelect, onClear, error }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (value || !open) return undefined;
    let ignore = false;
    setSearching(true);
    memberService
      .listMembers({ search: debounced, limit: 8 })
      .then((res) => !ignore && setResults(res.data))
      .catch(() => !ignore && setResults([]))
      .finally(() => !ignore && setSearching(false));
    return () => {
      ignore = true;
    };
  }, [debounced, open, value]);

  if (value) {
    return (
      <div className="picked-member">
        <div>
          <strong>{value.fullName}</strong>
          <span className="muted"> {value.memberId} - {value.email}</span>
        </div>
        {onClear && (
          <button type="button" className="icon-btn" onClick={onClear} aria-label="Change member">
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="picker">
      <div className="search-input">
        <Search size={16} />
        <input
          placeholder="Search by name, email, phone or member ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          aria-invalid={Boolean(error)}
        />
      </div>
      {open && (
        <ul className="picker-list">
          {searching && <li className="picker-note">Searching...</li>}
          {!searching && results.length === 0 && <li className="picker-note">No members found</li>}
          {results.map((m) => (
            <li key={m._id}>
              <button type="button" onClick={() => onSelect(m)}>
                <strong>{m.fullName}</strong>
                <span className="muted">{m.memberId} - {m.plan?.name || 'No plan'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
