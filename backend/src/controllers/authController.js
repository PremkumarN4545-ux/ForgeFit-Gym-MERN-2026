import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Member, { syncExpiredMembers } from '../models/Member.js';
import Payment from '../models/Payment.js';
import User, { syncExpiredUserMemberships } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { round2 } from '../utils/dates.js';
import { EMAIL_RE, throwIfErrors, validateUserRegistration } from '../utils/validators.js';

const DUMMY_HASH = bcrypt.hashSync('forgefit-dummy-password', 12);
const PLAN_FIELDS = 'name durationMonths price benefits';

const publicAdmin = (admin) => ({
  id: admin._id.toString(),
  name: admin.name,
  email: admin.email,
  role: 'admin',
});

const publicMembership = (member) => ({
  memberId: member.memberId,
  plan: member.plan
    ? {
        name: member.plan.name,
        durationMonths: member.plan.durationMonths,
        price: member.plan.price,
        benefits: member.plan.benefits,
      }
    : null,
  startDate: member.startDate,
  expiryDate: member.expiryDate,
  status: member.status,
});

function publicUser(user) {
  const memberProfile = user.memberProfile;
  const membership = memberProfile || user.membership;
  return {
    id: user._id.toString(),
    name: memberProfile?.fullName || user.fullName,
    fullName: memberProfile?.fullName || user.fullName,
    email: memberProfile?.email || user.email,
    phone: memberProfile?.phone || user.phone,
    role: 'member',
    accountStatus: user.accountStatus || 'Active',
    memberId: memberProfile?.memberId || null,
    membership: membership?.plan
      ? {
          plan: {
            name: membership.plan.name,
            durationMonths: membership.plan.durationMonths,
            price: membership.plan.price,
            benefits: membership.plan.benefits,
          },
          startDate: membership.startDate,
          expiryDate: membership.expiryDate,
          status: membership.status,
        }
      : null,
  };
}

const publicLegacyMember = (member) => ({
  id: member._id.toString(),
  name: member.fullName,
  fullName: member.fullName,
  email: member.email,
  phone: member.phone,
  role: 'member',
  ...publicMembership(member),
});

const createToken = (account, role, accountType) => jwt.sign(
  { sub: account._id.toString(), role, accountType },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn, algorithm: 'HS256' }
);

export const login = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please enter a valid email address');

  const admin = await Admin.findOne({ email }).select('+password');
  const passwordMatches = await bcrypt.compare(password, admin?.password || DUMMY_HASH);
  if (!admin || admin.role !== 'admin' || !passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({ token: createToken(admin, 'admin', 'admin'), admin: publicAdmin(admin) });
});

export const registerMember = asyncHandler(async (req, res) => {
  const { errors, value } = validateUserRegistration(req.body);
  throwIfErrors(errors);

  await User.init();
  const [existingUser, existingAdmin, existingLegacyAccount] = await Promise.all([
    User.exists({ email: value.email }),
    Admin.exists({ email: value.email }),
    Member.findOne({ email: value.email }).select('+password'),
  ]);
  if (existingUser || existingAdmin || existingLegacyAccount?.password) {
    throw new ApiError(409, 'An account with this email is already registered', {
      email: 'An account with this email is already registered',
    });
  }

  const user = await User.create({
    fullName: value.fullName,
    email: value.email,
    phone: value.phone,
    password: value.password,
    accountStatus: 'Active',
  });
  res.status(201).json({
    message: 'Account created successfully. You can now sign in.',
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      registrationDate: user.createdAt,
      accountStatus: user.accountStatus,
    },
  });
});

export const loginMember = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please enter a valid email address');

  const admin = await Admin.findOne({ email }).select('+password');
  if (admin) {
    const passwordMatches = await bcrypt.compare(password, admin.password);
    if (admin.role === 'admin' && passwordMatches) {
      res.json({
        token: createToken(admin, 'admin', 'admin'),
        member: publicAdmin(admin),
      });
      return;
    }
  }

  await syncExpiredUserMemberships({ email });
  const user = await User.findOne({ email })
    .select('+password')
    .populate('membership.plan', PLAN_FIELDS)
    .populate('memberProfile.plan', PLAN_FIELDS);
  if (user) {
    const passwordMatches = user.password ? await bcrypt.compare(password, user.password) : false;
    if (user.role !== 'member' || user.accountStatus !== 'Active' || !passwordMatches) {
      throw new ApiError(401, 'Invalid email or password');
    }
    if (user.memberProfile?.status === 'Inactive') {
      throw new ApiError(401, 'Invalid email or password');
    }

    res.json({
      token: createToken(user, 'member', 'user'),
      member: await publicUser(user),
    });
    return;
  }

  await syncExpiredMembers();
  const legacyMember = await Member.findOne({ email })
    .select('+password')
    .populate('plan', PLAN_FIELDS);
  const passwordMatches = await bcrypt.compare(password, legacyMember?.password || DUMMY_HASH);
  if (!legacyMember?.password || legacyMember.status === 'Inactive' || !passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    token: createToken(legacyMember, 'member', 'legacy-member'),
    member: publicLegacyMember(legacyMember),
  });
});

export const me = asyncHandler(async (req, res) => {
  if (req.accountRole === 'admin') {
    res.json({ admin: publicAdmin(req.account) });
    return;
  }

  if (req.accountType === 'user') {
    await syncExpiredUserMemberships({ _id: req.account._id });
    const user = await User.findById(req.account._id)
      .populate('membership.plan', PLAN_FIELDS)
      .populate('memberProfile.plan', PLAN_FIELDS);
    if (!user) throw new ApiError(401, 'Account no longer exists');
    res.json({ member: publicUser(user) });
    return;
  }

  await syncExpiredMembers();
  const legacyMember = await Member.findById(req.account._id).populate('plan', PLAN_FIELDS);
  if (!legacyMember) throw new ApiError(401, 'Account no longer exists');
  res.json({ member: publicLegacyMember(legacyMember) });
});

export const getMemberDashboard = asyncHandler(async (req, res) => {
  const isLegacyMember = req.accountType === 'legacy-member';
  if (isLegacyMember) await syncExpiredMembers();
  else await syncExpiredUserMemberships({ _id: req.account._id });
  const membershipAccount = isLegacyMember
    ? await Member.findById(req.account._id).populate('plan', PLAN_FIELDS)
    : await User.findById(req.account._id)
        .populate('membership.plan', PLAN_FIELDS)
        .populate('memberProfile.plan', PLAN_FIELDS);
  const memberProfile = isLegacyMember ? null : membershipAccount?.memberProfile;
  const membership = isLegacyMember ? membershipAccount : memberProfile || membershipAccount?.membership;
  const membershipPlan = membership?.plan;
  const paymentFilter = isLegacyMember
    ? { member: membershipAccount._id }
    : {
        $or: [
          { user: membershipAccount._id },
          ...(memberProfile?.sourceMember ? [{ member: memberProfile.sourceMember }] : []),
        ],
      };
  const payments = await Payment.find(paymentFilter)
    .select('paymentId receiptNumber memberName memberEmail memberPhone plan planName planDurationMonths membershipStartDate membershipExpiryDate amount paymentDate method transactionRef status paymentDetails source notes createdAt')
    .populate('plan', 'durationMonths')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();
  const totalPaid = round2(payments
    .filter((payment) => payment.status === 'Paid')
    .reduce((total, payment) => total + payment.amount, 0));
  const outstandingBalance = round2(payments
    .filter((payment) => payment.status === 'Pending')
    .reduce((total, payment) => total + payment.amount, 0));

  res.json({
    profile: {
      fullName: memberProfile?.fullName || req.account.fullName,
      email: memberProfile?.email || req.account.email,
      phone: memberProfile?.phone || membershipAccount.phone,
      memberId: isLegacyMember ? membership?.memberId || null : memberProfile?.memberId || null,
    },
    membership: isLegacyMember
      ? (membership ? publicMembership(membership) : null)
      : (membership?.plan
          ? {
              plan: {
                name: membershipPlan.name,
                durationMonths: membershipPlan.durationMonths,
                price: membershipPlan.price,
                benefits: membershipPlan.benefits,
              },
              startDate: membership.startDate,
              expiryDate: membership.expiryDate,
              status: membership.status,
            }
          : null),
    payments,
    paymentSummary: { totalPaid, outstandingBalance },
  });
});
