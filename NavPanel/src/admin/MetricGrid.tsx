import type { ReactNode } from 'react';

export default function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="admin-metric-grid">{children}</div>;
}
