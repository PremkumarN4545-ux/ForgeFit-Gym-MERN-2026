import User, { syncExpiredUserMemberships } from '../models/User.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import { asyncHandler } from '../utils/ApiError.js';
import { round2, todayUTC } from '../utils/dates.js';

const monthLabel = (d) =>
  d.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export const getDashboard = asyncHandler(async (req, res) => {
  await syncExpiredUserMemberships();

  const today = todayUTC();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const windowStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const in7Days = new Date(today.getTime() + 7 * 86400000);
  const memberProfileFilter = {
    'memberProfile.memberId': { $exists: true },
    'memberProfile.archivedAt': { $exists: false },
  };
  const membershipOnlyFilter = {
    'memberProfile.memberId': { $exists: false },
    'membership.plan': { $type: 'objectId' },
  };
  const allUserMembers = { $or: [memberProfileFilter, membershipOnlyFilter] };
  const memberStatusFilter = (status) => ({
    $or: [
      { ...memberProfileFilter, 'memberProfile.status': status },
      { ...membershipOnlyFilter, 'membership.status': status },
    ],
  });

  const [
    totalMembers,
    activeMembers,
    expiredMembers,
    inactiveMembers,
    totalPlans,
    activePlans,
    revenueAgg,
    monthRevenueAgg,
    monthlyAgg,
    distributionAgg,
    recentMembers,
    recentPayments,
    pendingPayments,
    expiringSoon,
    newMembersThisMonth,
  ] = await Promise.all([
    User.countDocuments(allUserMembers),
    User.countDocuments(memberStatusFilter('Active')),
    User.countDocuments(memberStatusFilter('Expired')),
    User.countDocuments(memberStatusFilter('Inactive')),
    Plan.countDocuments(),
    Plan.countDocuments({ status: 'Active' }),
    // Revenue counts ONLY payments with status "Paid".
    Payment.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([
      { $match: { status: 'Paid', paymentDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'Paid', paymentDate: { $gte: windowStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'UTC' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: allUserMembers },
      { $project: { plan: { $ifNull: ['$memberProfile.plan', '$membership.plan'] } } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
      { $lookup: { from: Plan.collection.name, localField: '_id', foreignField: '_id', as: 'plan' } },
      { $project: { _id: 0, count: 1, name: { $ifNull: [{ $arrayElemAt: ['$plan.name', 0] }, 'Unassigned'] } } },
      { $sort: { count: -1 } },
    ]),
    User.find(allUserMembers)
      .sort({ 'memberProfile.recordCreatedAt': -1, createdAt: -1 })
      .limit(5)
      .populate('memberProfile.plan', 'name')
      .populate('membership.plan', 'name'),
    Payment.find().sort({ createdAt: -1 }).limit(5),
    Payment.countDocuments({ status: 'Pending' }),
    User.countDocuments({
      $or: [
        { ...memberProfileFilter, 'memberProfile.status': 'Active', 'memberProfile.expiryDate': { $gte: today, $lte: in7Days } },
        { ...membershipOnlyFilter, 'membership.status': 'Active', 'membership.expiryDate': { $gte: today, $lte: in7Days } },
      ],
    }),
    User.countDocuments({
      $or: [
        { ...memberProfileFilter, 'memberProfile.recordCreatedAt': { $gte: monthStart } },
        { ...membershipOnlyFilter, createdAt: { $gte: monthStart } },
      ],
    }),
  ]);

  // Build a continuous 12-month series (months without payments show 0).
  const byMonth = new Map(monthlyAgg.map((m) => [m._id, m]));
  const monthlyRevenue = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
    const hit = byMonth.get(monthKey(d));
    monthlyRevenue.push({ month: monthKey(d), label: monthLabel(d), revenue: round2(hit?.revenue || 0), payments: hit?.count || 0 });
  }

  const recentMemberViews = recentMembers.map((user) => {
    const profile = user.memberProfile;
    const membership = profile || user.membership;
    return {
      _id: user._id,
      memberId: profile?.memberId || null,
      fullName: profile?.fullName || user.fullName,
      email: profile?.email || user.email,
      plan: membership?.plan || null,
      status: membership?.status || user.accountStatus,
      createdAt: profile?.recordCreatedAt || user.createdAt,
    };
  });

  res.json({
    stats: {
      totalMembers,
      activeMembers,
      expiredMembers,
      inactiveMembers,
      totalPlans,
      activePlans,
      totalRevenue: round2(revenueAgg[0]?.total || 0),
      monthRevenue: round2(monthRevenueAgg[0]?.total || 0),
      pendingPayments,
      expiringSoon,
      newMembersThisMonth,
    },
    monthlyRevenue,
    planDistribution: distributionAgg,
    recentMembers: recentMemberViews,
    recentPayments,
  });
});
