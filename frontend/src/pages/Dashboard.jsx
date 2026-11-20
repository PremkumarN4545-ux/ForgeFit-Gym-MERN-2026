import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, Clock, IndianRupee, Layers, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import * as dashboardService from '../services/dashboardService';
import { getErrorMessage } from '../services/api';
import DashboardCard from '../components/DashboardCard.jsx';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import { formatCurrency, formatDate } from '../utils/format';

const PIE_COLORS = ['#0f2557', '#2563eb', '#60a5fa', '#93c5fd', '#1e40af', '#7dd3fc', '#475569', '#bfdbfe'];
const compact = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    setData(null);
    dashboardService.getDashboard().then(setData).catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <PageLoader label="Loading dashboard..." />;

  const { stats, monthlyRevenue, planDistribution, recentMembers, recentPayments } = data;
  const pct = (n) => (stats.totalMembers ? Math.round((n / stats.totalMembers) * 100) : 0);
  const hasRevenue = monthlyRevenue.some((m) => m.revenue > 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="An overview of your gym's membership and revenue." />

      <div className="stat-grid">
        <DashboardCard icon={Users} label="Total members" value={stats.totalMembers} tone="navy" />
        <DashboardCard icon={UserCheck} label="Active members" value={stats.activeMembers} tone="green" />
        <DashboardCard icon={UserX} label="Expired members" value={stats.expiredMembers} tone="red" />
        <DashboardCard icon={Layers} label="Membership plans" value={stats.totalPlans} hint={`${stats.activePlans} active`} tone="blue" />
        <DashboardCard icon={IndianRupee} label="Total revenue" value={formatCurrency(stats.totalRevenue)} hint="Paid payments only" tone="navy" />
      </div>

      <div className="grid-2">
        <section className="card">
          <h3 className="card-title">Monthly revenue (last 12 months)</h3>
          {hasRevenue ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} cursor={{ fill: '#eff6ff' }} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No revenue yet" text="Record a Paid payment to see monthly revenue." />
          )}
        </section>

        <section className="card">
          <h3 className="card-title">Membership distribution</h3>
          {planDistribution.length ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planDistribution} dataKey="count" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {planDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} member${v === 1 ? '' : 's'}`, n]} />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No members yet" text="Members will appear here grouped by plan." />
          )}
        </section>
      </div>

      <section className="card">
        <h3 className="card-title">Membership statistics</h3>
        <div className="progress-list">
          {[
            ['Active', stats.activeMembers, 'green'],
            ['Expired', stats.expiredMembers, 'red'],
            ['Inactive', stats.inactiveMembers, 'gray'],
          ].map(([label, n, tone]) => (
            <div key={label} className="progress-row">
              <span>{label}</span>
              <div className="progress"><div className={`progress-fill tone-bg-${tone}`} style={{ width: `${pct(n)}%` }} /></div>
              <span className="muted">{n} ({pct(n)}%)</span>
            </div>
          ))}
        </div>
        <div className="mini-stats">
          <div><UserPlus size={18} /><strong>{stats.newMembersThisMonth}</strong><span>New members this month</span></div>
          <div><CalendarClock size={18} /><strong>{stats.expiringSoon}</strong><span>Expiring in 7 days</span></div>
          <div><IndianRupee size={18} /><strong>{formatCurrency(stats.monthRevenue)}</strong><span>Revenue this month</span></div>
          <div><Clock size={18} /><strong>{stats.pendingPayments}</strong><span>Pending payments</span></div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-title-row">
            <h3 className="card-title">Recent registrations</h3>
            <Link to="/members">View all</Link>
          </div>
          {recentMembers.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Member</th><th>Plan</th><th>Joined</th><th>Status</th></tr></thead>
                <tbody>
                  {recentMembers.map((m) => (
                    <tr key={m._id}>
                      <td><Link to={`/members/${m._id}`}><strong>{m.fullName}</strong></Link><div className="muted small">{m.memberId}</div></td>
                      <td>{m.plan?.name || '-'}</td>
                      <td>{formatDate(m.joiningDate)}</td>
                      <td><StatusBadge status={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No members yet" />
          )}
        </section>

        <section className="card">
          <div className="card-title-row">
            <h3 className="card-title">Recent payments</h3>
            <Link to="/payments">View all</Link>
          </div>
          {recentPayments.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Member</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p._id}>
                      <td><strong>{p.memberName}</strong><div className="muted small">{p.paymentId}</div></td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No payments yet" />
          )}
        </section>
      </div>
    </>
  );
}
