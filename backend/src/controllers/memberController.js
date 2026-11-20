import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import User, { syncExpiredUserMemberships } from '../models/User.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import { nextSequence } from '../models/Counter.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { MEMBER_STATUSES } from '../utils/constants.js';
import { addMonths, ageFrom, deriveStatus, round2, todayUTC } from '../utils/dates.js';
import {
  escapeRegex,
  isObjectId,
  parsePagination,
  queryString,
  throwIfErrors,
  validateMember,
} from '../utils/validators.js';

const populatePlan = { path: 'memberProfile.plan', select: 'name durationMonths price status' };

function registeredUserView(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    accountStatus: user.accountStatus || 'Active',
    registrationDate: user.createdAt,
  };
}

function temporaryPassword() {
  return `Ff1-${randomBytes(12).toString('base64url')}`;
}

function assertDevelopmentPasswordReset() {
  if (env.nodeEnv === 'production') {
    throw new ApiError(403, 'Temporary password resets are available only outside production.');
  }
}

function memberView(user) {
  const profile = user.memberProfile;
  return {
    _id: user._id,
    memberId: profile.memberId,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    age: ageFrom(profile.dateOfBirth, todayUTC()),
    address: profile.address,
    joiningDate: profile.joiningDate,
    plan: profile.plan,
    startDate: profile.startDate,
    expiryDate: profile.expiryDate,
    status: profile.status,
    createdAt: profile.recordCreatedAt || user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function findMemberOr404(id) {
  if (!isObjectId(id)) throw new ApiError(404, 'Member not found');
  const user = await User.findOne({
    'memberProfile.memberId': { $exists: true },
    'memberProfile.archivedAt': { $exists: false },
    $or: [{ _id: id }, { legacyMember: id }, { 'memberProfile.sourceMember': id }],
  });
  if (!user) throw new ApiError(404, 'Member not found');
  return user;
}

export const listRegisteredUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { 'memberProfile.memberId': { $exists: false } };
  const search = queryString(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
  }
  const accountStatus = queryString(req.query.accountStatus);
  if (accountStatus && !['Active', 'Inactive'].includes(accountStatus)) {
    throw new ApiError(400, 'Invalid account status filter');
  }
  if (accountStatus) filter.accountStatus = accountStatus;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('fullName email phone accountStatus createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    data: users.map(registeredUserView),
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
  });
});

export const getRegisteredUser = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new ApiError(404, 'Registered user not found');
  const user = await User.findOne({ _id: req.params.id, 'memberProfile.memberId': { $exists: false } })
    .select('fullName email phone accountStatus createdAt')
    .lean();
  if (!user) throw new ApiError(404, 'Registered user not found');
  res.json(registeredUserView(user));
});

export const resetRegisteredUserPassword = asyncHandler(async (req, res) => {
  assertDevelopmentPasswordReset();
  if (!isObjectId(req.params.id)) throw new ApiError(404, 'Registered user not found');
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'Registered user not found');

  const password = temporaryPassword();
  user.password = password;
  await user.save();
  res.json({
    message: 'Temporary password generated. It is shown only once.',
    user: { id: user._id, fullName: user.fullName, email: user.email, memberId: user.memberProfile?.memberId || null },
    temporaryPassword: password,
  });
});

export const setRegisteredUserAccountStatus = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new ApiError(404, 'Registered user not found');
  if (!['Active', 'Inactive'].includes(req.body?.accountStatus)) {
    throw new ApiError(400, 'Account status must be Active or Inactive');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'Registered user not found');
  user.accountStatus = req.body.accountStatus;
  if (user.memberProfile) {
    user.memberProfile.status = req.body.accountStatus === 'Inactive'
      ? 'Inactive'
      : deriveStatus(user.memberProfile.expiryDate);
  }
  await user.save();
  res.json({ user: registeredUserView(user.toObject()) });
});

export const listMembers = asyncHandler(async (req, res) => {
  await syncExpiredUserMemberships();
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {
    'memberProfile.memberId': { $exists: true },
    'memberProfile.archivedAt': { $exists: false },
  };

  const search = queryString(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { 'memberProfile.fullName': rx },
      { 'memberProfile.email': rx },
      { 'memberProfile.phone': rx },
      { 'memberProfile.memberId': rx },
    ];
  }
  const status = queryString(req.query.status);
  if (MEMBER_STATUSES.includes(status)) filter['memberProfile.status'] = status;
  const plan = queryString(req.query.plan);
  if (plan) {
    if (!isObjectId(plan)) throw new ApiError(400, 'Invalid plan filter');
    filter['memberProfile.plan'] = plan;
  }

  const [data, total] = await Promise.all([
    User.find(filter).populate(populatePlan).sort({ 'memberProfile.recordCreatedAt': -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({
    data: data.map(memberView),
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
  });
});

export const getMember = asyncHandler(async (req, res) => {
  await syncExpiredUserMemberships();
  const user = await findMemberOr404(req.params.id);
  await user.populate(populatePlan);
  const [hasPassword] = await Promise.all([
    User.exists({ _id: user._id, password: { $type: 'string' } }),
  ]);
  const member = memberView(user);
  res.json({
    ...member,
    loginInfo: {
      enabled: user.accountStatus === 'Active' && user.memberProfile.status !== 'Inactive',
      credentialState: hasPassword ? 'Password configured' : 'No credentials configured',
    },
  });
});

export const resetMemberPassword = asyncHandler(async (req, res) => {
  assertDevelopmentPasswordReset();
  const user = await findMemberOr404(req.params.id);
  const password = temporaryPassword();
  user.password = password;
  await user.save();
  res.json({
    message: 'Temporary password generated. It is shown only once.',
    member: {
      id: user._id,
      memberId: user.memberProfile.memberId,
      fullName: user.memberProfile.fullName,
      email: user.memberProfile.email,
    },
    linkedRegisteredAccount: true,
    temporaryPassword: password,
  });
});

export const setMemberAccountStatus = asyncHandler(async (req, res) => {
  if (!['Active', 'Inactive'].includes(req.body?.accountStatus)) {
    throw new ApiError(400, 'Account status must be Active or Inactive');
  }
  const user = await findMemberOr404(req.params.id);
  user.memberProfile.status = req.body.accountStatus === 'Inactive'
    ? 'Inactive'
    : deriveStatus(user.memberProfile.expiryDate);
  user.accountStatus = req.body.accountStatus;
  if (user.membership) user.membership.status = user.memberProfile.status;
  await user.save();
  res.json({
    member: { id: user._id, memberId: user.memberProfile.memberId, status: user.memberProfile.status },
    loginEnabled: user.accountStatus === 'Active' && user.memberProfile.status !== 'Inactive',
  });
});

export const createMember = asyncHandler(async (req, res) => {
  const { errors, value } = validateMember(req.body);
  throwIfErrors(errors);

  const plan = await Plan.findById(value.plan);
  if (!plan) throw new ApiError(400, 'Selected plan does not exist', { plan: 'Selected plan does not exist' });
  if (plan.status !== 'Active') throw new ApiError(400, 'Selected plan is inactive', { plan: 'Selected plan is inactive' });

  const existingUser = await User.findOne({ email: value.email });
  if (existingUser?.memberProfile?.memberId) {
    throw new ApiError(409, 'A member with this email already exists', { email: 'A member with this email already exists' });
  }

  // Expiry is always calculated from the plan duration, never trusted from the client.
  const expiryDate = addMonths(value.startDate, plan.durationMonths);
  const seq = await nextSequence('member');
  const profile = {
    ...value,
    memberId: `FF-${String(seq).padStart(4, '0')}`,
    expiryDate,
    status: deriveStatus(expiryDate, value.status),
    recordCreatedAt: new Date(),
  };
  const membership = {
    plan: plan._id,
    startDate: value.startDate,
    expiryDate,
    status: profile.status,
  };
  const user = existingUser || new User({
    fullName: value.fullName,
    email: value.email,
    phone: value.phone,
    accountStatus: 'Active',
  });
  user.memberProfile = profile;
  if (!user.membership?.plan) user.membership = membership;
  await user.save();
  await user.populate(populatePlan);
  res.status(201).json(memberView(user));
});

export const updateMember = asyncHandler(async (req, res) => {
  const user = await findMemberOr404(req.params.id);
  const { errors, value } = validateMember(req.body);
  throwIfErrors(errors);

  const profile = user.memberProfile;
  const planChanged = String(profile.plan?._id || profile.plan) !== value.plan;
  const plan = await Plan.findById(value.plan);
  if (!plan) throw new ApiError(400, 'Selected plan does not exist', { plan: 'Selected plan does not exist' });
  if (planChanged && plan.status !== 'Active') {
    throw new ApiError(400, 'Selected plan is inactive', { plan: 'Selected plan is inactive' });
  }
  const emailOwner = await User.findOne({ email: value.email, _id: { $ne: user._id } }).select('_id');
  if (emailOwner) {
    throw new ApiError(409, 'A user with this email already exists', { email: 'A user with this email already exists' });
  }

  // Recalculate expiry only when the plan or start date actually changed.
  const startChanged = profile.startDate.getTime() !== value.startDate.getTime();
  const expiryDate = planChanged || startChanged ? addMonths(value.startDate, plan.durationMonths) : profile.expiryDate;
  const status = deriveStatus(expiryDate, value.status);

  user.fullName = value.fullName;
  user.email = value.email;
  user.phone = value.phone;
  user.memberProfile = {
    ...profile.toObject(),
    ...value,
    expiryDate,
    status,
  };
  if (user.membership) {
    user.membership.set({ plan: plan._id, startDate: value.startDate, expiryDate, status });
  }
  await user.save();
  await user.populate(populatePlan);
  res.json(memberView(user));
});

export const deleteMember = asyncHandler(async (req, res) => {
  const user = await findMemberOr404(req.params.id);
  user.memberProfile.archivedAt = new Date();
  user.memberProfile.status = 'Inactive';
  user.accountStatus = 'Inactive';
  if (user.membership) user.membership.status = 'Inactive';
  await user.save();
  res.json({ message: 'Member deleted' });
});

export const getMemberPayments = asyncHandler(async (req, res) => {
  const user = await findMemberOr404(req.params.id);
  const paymentFilter = {
    $or: [
      { user: user._id },
      ...(user.memberProfile.sourceMember ? [{ member: user.memberProfile.sourceMember }] : []),
    ],
  };
  const data = await Payment.find(paymentFilter).sort({ paymentDate: -1, createdAt: -1 });
  const totalPaid = round2(data.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0));
  res.json({ data, totalPaid });
});
