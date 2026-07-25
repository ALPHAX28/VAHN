"use client";

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: "green" | "blue" | "amber" | "purple" | "red";
  subLabel?: string;
}

function StatIcon({ path, color }: { path: string; color: string }) {
  return (
    <div className={`admin-stat-icon admin-stat-icon--${color}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

export default function AdminStatsCard({ cards }: { cards: StatCard[] }) {
  return (
    <div className="admin-stats-grid">
      {cards.map((card) => (
        <div key={card.label} className="admin-stat-card">
          <div className="admin-stat-card-body">
            <div className="admin-stat-info">
              <span className="admin-stat-label">{card.label}</span>
              <span className="admin-stat-value">{card.value}</span>
              {card.subLabel && <span className="admin-stat-sub">{card.subLabel}</span>}
            </div>
            <StatIcon path={card.icon} color={card.color} />
          </div>
        </div>
      ))}
    </div>
  );
}
