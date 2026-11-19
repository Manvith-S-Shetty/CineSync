import type { ReactNode } from 'react';

export default function AdminPlaceholder({
  icon,
  eyebrow,
  title,
  description,
  planned,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <div className="admin-page">
      <section className="admin-placeholder">
        <span className="admin-placeholder__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="admin-pill">Next phase</span>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2 className="admin-placeholder__title">{title}</h2>
        <p className="admin-placeholder__text">{description}</p>

        <div className="admin-placeholder__planned">
          <p className="admin-placeholder__planned-label">Planned for this section</p>
          <ul>
            {planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <p className="admin-placeholder__note">
          No placeholder statistics are shown. This page will read from the existing protected
          admin APIs when it is implemented.
        </p>
      </section>
    </div>
  );
}
