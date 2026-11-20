export default function DashboardCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </div>
  );
}
