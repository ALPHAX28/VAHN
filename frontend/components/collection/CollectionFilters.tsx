'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Filter } from '@/lib/api/types';

interface Props { filters: Filter[]; }

export default function CollectionFilters({ filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.append(key, value);
    } else {
      const values = params.getAll(key).filter((v) => v !== value);
      params.delete(key);
      values.forEach((v) => params.append(key, v));
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div>
      <p style={{ fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 'var(--space-lg)' }}>
        Filters
      </p>
      {filters.map((filter) => (
        <div key={filter.id} style={{ marginBottom: 'var(--space-lg)' }}>
          <p style={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            {filter.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filter.values.map((value) => {
              const isChecked = searchParams.getAll(`filter.${filter.id}`).includes(value.input);
              return (
                <label
                  key={value.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleFilterChange(`filter.${filter.id}`, value.input, e.target.checked)}
                    style={{ accentColor: 'var(--color-maroon)' }}
                  />
                  <span>{value.label}</span>
                  <span style={{ color: 'var(--color-grey-dark)', fontSize: '0.75rem' }}>({value.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
