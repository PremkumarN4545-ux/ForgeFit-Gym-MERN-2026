import { createHmac, timingSafeEqual } from 'node:crypto';
import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { PAYMENT_STATUSES } from '../utils/constants.js';
import { addMonths, deriveStatus, round2, todayUTC } from '../utils/dates.js';
import {
  escapeRegex,
  isObjectId,
  parsePagination,
  queryString,
  throwIfErrors,
  validatePayment,
} from '../utils/validators.js';

const PAYMENT_PREFERENCES = ['Google Pay', 'PhonePe', 'UPI', 'QR Code'];

function requireRazorpayCredentials() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new ApiError(503, 'Online payments are not configured. Please contact the gym.');
  }
  if (env.nodeEnv !== 'production' && !env.razorpayKeyId.startsWith('rzp_test_')) {
    throw new ApiError(503, 'Development checkout requires Razorpay test-mode credentials.');
  }
}

async function razorpayRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new ApiError(502, `Unable to reach Razorpay: ${error.message}`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(502, data?.error?.description || `Razorpay request failed (${response.status})`);
  }
  return data;
}

function isValidRazorpaySignature(orderId, paymentId, signature) {
  if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const provided = Buffer.from(signature, 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function paymentResponse(payment, plan) {
  const preference = payment.notes?.replace(/^Paid online via /, '');
  return {
    paymentId: payment.transactionRef,
    transactionId: payment.transactionRef,
    receiptNumber: payment.receiptNumber,
    receiptDate: payment.createdAt,
    memberName: payment.memberName,
    memberEmail: payment.memberEmail,
    memberPhone: payment.memberPhone,
    paymentDate: payment.paymentDate,
    planName: payment.planName,
    durationMonths: payment.planDurationMonths || plan?.durationMonths,
    membershipStartDate: payment.membershipStartDate,
    membershipExpiryDate: payment.membershipExpiryDate,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    preferredMethod: PAYMENT_PREFERENCES.includes(preference) ? preference : payment.method,
    plan: plan ? { name: plan.name, durationMonths: plan.durationMonths } : null,
  };
}

async function applyMembershipPayment(accountId, accountType, plan, paymentDate) {
  const startDate = new Date(Date.UTC(
    paymentDate.getUTCFullYear(),
    paymentDate.getUTCMonth(),
    paymentDate.getUTCDate()
  ));
  const expiryDate = addMonths(startDate, plan.durationMonths);
  const isLegacyMember = accountType === 'legacy-member';
  const account = isLegacyMember
    ? await Member.findById(accountId).select('status')
    : await User.findById(accountId).select(
        'membership.status membership.lastMembershipPaymentAt memberProfile.status memberProfile.lastMembershipPaymentAt'
      );
  if (!account) throw new ApiError(401, 'Account no longer exists');
  const currentStatus = isLegacyMember
    ? account.status
    : account.memberProfile?.status || account.membership?.status;
  const prefix = isLegacyMember ? '' : 'membership.';

  const Model = isLegacyMember ? Member : User;
  const set = {
    [`${prefix}plan`]: plan._id,
    [`${prefix}startDate`]: startDate,
    [`${prefix}expiryDate`]: expiryDate,
    [`${prefix}status`]: deriveStatus(expiryDate, currentStatus === 'Inactive' ? 'Inactive' : undefined),
    [`${prefix}lastMembershipPaymentAt`]: paymentDate,
  };
  if (!isLegacyMember && account.memberProfile) {
    set['memberProfile.plan'] = plan._id;
    set['memberProfile.startDate'] = startDate;
    set['memberProfile.expiryDate'] = expiryDate;
    set['memberProfile.status'] = set['membership.status'];
    set['memberProfile.lastMembershipPaymentAt'] = paymentDate;
  }
  await Model.updateOne(
    {
      _id: accountId,
      $or: [
        { [`${prefix}lastMembershipPaymentAt`]: { $exists: false } },
        { [`${prefix}lastMembershipPaymentAt`]: null },
        { [`${prefix}lastMembershipPaymentAt`]: { $lte: paymentDate } },
      ],
    },
    { $set: set }
  );
}

async function findMemberAccount(req) {
  if (req.accountType === 'legacy-member') {
    const member = await Member.findById(req.account._id);
    if (!member) throw new ApiError(401, 'Account no longer exists');
    return { account: member, accountType: 'legacy-member' };
  }
  if (req.accountType === 'user') {
    const user = await User.findById(req.account._id);
    if (!user) throw new ApiError(401, 'Account no longer exists');
    return { account: user, accountType: 'user' };
  }
  throw new ApiError(403, 'Member account required');
}

async function findPaymentOr404(id) {
  if (!isObjectId(id)) throw new ApiError(404, 'Payment not found');
  const payment = await Payment.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
}

async function assertRefFree(transactionRef, excludeId) {
  if (!transactionRef) return;
  const q = { transactionRef };
  if (excludeId) q._id = { $ne: excludeId };
  if (await Payment.exists(q)) {
    const msg = 'A payment with this transaction reference already exists';
    throw new ApiError(409, msg, { transactionRef: msg });
  }
}

/** Global totals shown on the Payments page. Only "Paid" payments count as revenue. */
async function buildSummary() {
  const today = todayUTC();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const [byStatus, month] = await Promise.all([
    Payment.aggregate([{ $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { status: 'Paid', paymentDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const by = Object.fromEntries(byStatus.map((s) => [s._id, s]));
  return {
    totalRevenue: round2(by.Paid?.total || 0),
    paidCount: by.Paid?.count || 0,
    pendingCount: by.Pending?.count || 0,
    pendingAmount: round2(by.Pending?.total || 0),
    failedCount: by.Failed?.count || 0,
    monthRevenue: round2(month[0]?.total || 0),
  };
}

export const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  const status = queryString(req.query.status);
  if (PAYMENT_STATUSES.includes(status)) filter.status = status;
  const member = queryString(req.query.member);
  if (member) {
    if (!isObjectId(member)) throw new ApiError(400, 'Invalid member filter');
    const linkedUser = await User.findOne({
      $or: [{ _id: member }, { legacyMember: member }, { 'memberProfile.sourceMember': member }],
    }).select('_id legacyMember memberProfile.sourceMember');
    const relatedIds = new Set([member]);
    if (linkedUser) {
      relatedIds.add(String(linkedUser._id));
      if (linkedUser.legacyMember) relatedIds.add(String(linkedUser.legacyMember));
      if (linkedUser.memberProfile?.sourceMember) relatedIds.add(String(linkedUser.memberProfile.sourceMember));
    }
    filter.$and = [{
      $or: [
        { member: { $in: [...relatedIds] } },
        { user: { $in: [...relatedIds] } },
      ],
    }];
  }
  const search = queryString(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ paymentId: rx }, { memberName: rx }, { memberCode: rx }, { planName: rx }, { transactionRef: rx }] },
    ];
  }

  const [data, total, summary] = await Promise.all([
    Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
    buildSummary(),
  ]);
  res.json({ data, summary, pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
});

export const getPayment = asyncHandler(async (req, res) => {
  res.json(await findPaymentOr404(req.params.id));
});

export const createPayment = asyncHandler(async (req, res) => {
  const { errors, value } = validatePayment(req.body);
  throwIfErrors(errors);

  const user = await User.findById(value.member).populate('memberProfile.plan');
  const member = user?.memberProfile ? null : await Member.findById(value.member);
  if (!user?.memberProfile && !member) throw new ApiError(400, 'Member not found', { member: 'Member not found' });

  const profile = user?.memberProfile;
  const currentPlan = profile?.plan?._id || profile?.plan || member?.plan;
  const plan = await Plan.findById(value.plan || currentPlan);
  await assertRefFree(value.transactionRef);

  const seq = await nextSequence('payment');
  const payment = await Payment.create({
    paymentId: `PAY-${String(seq).padStart(5, '0')}`,
    ...(profile ? { user: user._id } : { member: member._id }),
    memberCode: profile?.memberId || member?.memberId,
    memberName: profile?.fullName || member?.fullName,
    memberEmail: profile?.email || member?.email,
    memberPhone: profile?.phone || member?.phone,
    plan: plan?._id,
    planName: plan?.name || '-',
    planDurationMonths: plan?.durationMonths,
    membershipStartDate: profile?.startDate || member?.startDate,
    membershipExpiryDate: profile?.expiryDate || member?.expiryDate,
    amount: value.amount,
    paymentDate: value.paymentDate,
    method: value.method,
    transactionRef: value.transactionRef,
    paymentDetails: value.paymentDetails,
    source: 'Admin',
    status: value.status,
    notes: value.notes,
  });
  res.status(201).json(payment);
});

export const updatePayment = asyncHandler(async (req, res) => {
  const payment = await findPaymentOr404(req.params.id);
  const { errors, value } = validatePayment(req.body, { requireMember: false });
  throwIfErrors(errors);
  await assertRefFree(value.transactionRef, payment._id);

  payment.set({
    amount: value.amount,
    paymentDate: value.paymentDate,
    method: value.method,
    paymentDetails: value.paymentDetails, // undefined clears it (e.g. switched to Cash)
    status: value.status,
    transactionRef: value.transactionRef, // undefined clears it
    notes: value.notes,
  });
  await payment.save();
  res.json(payment);
});

export const deletePayment = asyncHandler(async (req, res) => {
  const payment = await findPaymentOr404(req.params.id);
  await payment.deleteOne();
  res.json({ message: 'Payment deleted' });
});

/**
 * Member self-service: a signed-in member submits a payment for their own membership.
 * No gateway is integrated, so it is stored as "Pending" until the gym confirms receipt
 * (admin marks it Paid). The amount always comes from the plan price, never from the client.
 */
export const submitMemberPayment = asyncHandler(async (req, res) => {
  const isLegacyMember = req.accountType === 'legacy-member';
  if (!isLegacyMember && req.accountType !== 'user') throw new ApiError(403, 'Member account required');
  const account = isLegacyMember
    ? await Member.findById(req.account._id)
    : await User.findById(req.account._id).populate('memberProfile.plan');
  if (!account) throw new ApiError(401, 'Account no longer exists');
  const profile = isLegacyMember ? null : account.memberProfile;
  const membership = profile || account.membership;
  if (!membership?.plan) {
    throw new ApiError(403, 'Payments can only be submitted for an account linked to a membership. Please contact the gym.');
  }

  const { errors, value } = validatePayment(
    { ...req.body, amount: 1, paymentDate: undefined, status: 'Pending' },
    { requireMember: false }
  );
  throwIfErrors(errors);

  const currentPlanId = membership.plan?._id || membership.plan;
  const planId = typeof req.body?.plan === 'string' && req.body.plan ? req.body.plan : String(currentPlanId);
  if (!isObjectId(planId)) throw new ApiError(400, 'Invalid plan', { plan: 'Invalid plan' });
  const plan = await Plan.findById(planId);
  if (!plan || (plan.status !== 'Active' && String(plan._id) !== String(currentPlanId))) {
    throw new ApiError(400, 'Selected plan is not available', { plan: 'Selected plan is not available' });
  }
  await assertRefFree(value.transactionRef);

  const seq = await nextSequence('payment');
  const payment = await Payment.create({
    paymentId: `PAY-${String(seq).padStart(5, '0')}`,
    ...(isLegacyMember ? { member: account._id } : { user: account._id }),
    memberCode: profile?.memberId || account.memberId,
    memberName: profile?.fullName || account.fullName,
    memberEmail: profile?.email || account.email,
    memberPhone: profile?.phone || account.phone,
    plan: plan._id,
    planName: plan.name,
    planDurationMonths: plan.durationMonths,
    membershipStartDate: membership.startDate,
    membershipExpiryDate: membership.expiryDate,
    amount: plan.price,
    paymentDate: todayUTC(),
    method: value.method,
    paymentDetails: value.paymentDetails,
    transactionRef: value.transactionRef,
    source: 'Member',
    status: 'Pending',
    notes: value.notes,
  });
  res.status(201).json(payment);
});

export const createMembershipOrder = asyncHandler(async (req, res) => {
  requireRazorpayCredentials();
  const planId = typeof req.body?.plan === 'string' ? req.body.plan : '';
  if (!isObjectId(planId)) throw new ApiError(400, 'Select an available membership plan');
  const preferredMethod = PAYMENT_PREFERENCES.includes(req.body?.method) ? req.body.method : '';
  if (!preferredMethod) throw new ApiError(400, 'Select a payment method');

  const [accountDetails, plan] = await Promise.all([
    findMemberAccount(req),
    Plan.findOne({ _id: planId, status: 'Active' }),
  ]);
  if (!plan) throw new ApiError(400, 'Selected plan is not available');

  const { account, accountType } = accountDetails;
  const submittedPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const phone = submittedPhone || account.memberProfile?.phone || account.phone || '';
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || !/^[+()\d\s-]{7,20}$/.test(phone)) {
    throw new ApiError(400, 'Enter a valid phone number to continue', { phone: 'Enter a valid phone number to continue' });
  }

  const amount = Math.round(round2(plan.price) * 100);
  if (amount < 100) throw new ApiError(400, 'The selected plan must have a price of at least ₹1 to use online payment.');

  const order = await razorpayRequest('/orders', {
    method: 'POST',
    body: {
      amount,
      currency: 'INR',
      receipt: `ff-${account._id}-${Date.now()}`,
      notes: {
        accountId: String(account._id),
        accountType,
        planId: String(plan._id),
        preferredMethod,
      },
    },
  });
  if (order.amount !== amount || order.currency !== 'INR' || !/^order_[\w]+$/.test(order.id || '')) {
    throw new ApiError(502, 'Razorpay returned invalid order details. Please try again.');
  }
  if (phone !== account.phone || (account.memberProfile && phone !== account.memberProfile.phone)) {
    account.phone = phone;
    if (account.memberProfile) account.memberProfile.phone = phone;
    await account.save();
  }
  res.status(201).json({
    keyId: env.razorpayKeyId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    plan: { name: plan.name, durationMonths: plan.durationMonths },
  });
});

export const verifyMembershipPayment = asyncHandler(async (req, res) => {
  requireRazorpayCredentials();
  const { account, accountType, member: isLegacyMember } = await findMemberAccount(req);

  const orderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id : '';
  const gatewayPaymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id : '';
  const signature = req.body?.razorpay_signature;
  if (!/^order_[\w]+$/.test(orderId) || !/^pay_[\w]+$/.test(gatewayPaymentId)) {
    throw new ApiError(400, 'Invalid Razorpay payment response');
  }
  if (!isValidRazorpaySignature(orderId, gatewayPaymentId, signature)) {
    throw new ApiError(400, 'Payment signature verification failed');
  }

  let payment = await Payment.findOne({ gatewayOrderId: orderId });
  const paymentAccountId = (saved) => String(isLegacyMember ? saved.member : saved.user);
  if (payment && paymentAccountId(payment) !== String(account._id)) {
    throw new ApiError(403, 'This payment does not belong to your account');
  }
  if (payment && payment.transactionRef !== gatewayPaymentId) {
    throw new ApiError(409, 'This order has already been completed with a different payment');
  }

  let plan;
  if (!payment) {
    const order = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}`);
    if (order.notes?.accountId !== String(account._id) || order.notes?.accountType !== accountType) {
      throw new ApiError(403, 'This payment does not belong to your account');
    }
    if (order.currency !== 'INR' || !Number.isInteger(order.amount) || order.amount < 100) {
      throw new ApiError(400, 'The payment order details are invalid');
    }
    plan = await Plan.findById(order.notes.planId);
    if (!plan) throw new ApiError(400, 'The membership plan for this payment is no longer available');

    let gatewayPayment = await razorpayRequest(`/payments/${encodeURIComponent(gatewayPaymentId)}`);
    if (
      gatewayPayment.order_id !== orderId ||
      gatewayPayment.amount !== order.amount ||
      gatewayPayment.currency !== order.currency
    ) {
      throw new ApiError(400, 'Payment details do not match the selected order');
    }
    if (gatewayPayment.status === 'authorized') {
      gatewayPayment = await razorpayRequest(`/payments/${encodeURIComponent(gatewayPaymentId)}/capture`, {
        method: 'POST',
        body: { amount: gatewayPayment.amount, currency: gatewayPayment.currency },
      });
    }
    if (gatewayPayment.status !== 'captured') {
      throw new ApiError(402, 'Razorpay has not confirmed a captured payment. You can retry or choose another payment method.');
    }

    const paymentDate = gatewayPayment.created_at
      ? new Date(gatewayPayment.created_at * 1000)
      : new Date();
    const membershipStartDate = new Date(Date.UTC(
      paymentDate.getUTCFullYear(),
      paymentDate.getUTCMonth(),
      paymentDate.getUTCDate()
    ));
    const membershipExpiryDate = addMonths(membershipStartDate, plan.durationMonths);
    const sequence = await nextSequence('payment');
    const receiptSequence = await nextSequence('receipt');
    try {
      payment = await Payment.create({
        paymentId: `PAY-${String(sequence).padStart(5, '0')}`,
        receiptNumber: `FF-RCT-${String(receiptSequence).padStart(6, '0')}`,
        gatewayOrderId: orderId,
        ...(isLegacyMember
          ? { member: account._id, memberCode: account.memberId }
          : { user: account._id, memberCode: account.memberProfile?.memberId }),
        memberName: account.memberProfile?.fullName || account.fullName,
        memberEmail: account.memberProfile?.email || account.email,
        memberPhone: account.memberProfile?.phone || account.phone,
        plan: plan._id,
        planName: plan.name,
        planDurationMonths: plan.durationMonths,
        membershipStartDate,
        membershipExpiryDate,
        amount: round2(order.amount / 100),
        paymentDate,
        method: 'UPI',
        transactionRef: gatewayPaymentId,
        source: 'Member',
        status: 'Paid',
        notes: `Paid online via ${PAYMENT_PREFERENCES.includes(order.notes?.preferredMethod) ? order.notes.preferredMethod : 'UPI'}`,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      payment = await Payment.findOne({ gatewayOrderId: orderId });
      if (!payment) throw error;
      if (paymentAccountId(payment) !== String(account._id)) {
        throw new ApiError(403, 'This payment does not belong to your account');
      }
    }
  } else {
    plan = await Plan.findById(payment.plan);
  }

  if (plan) await applyMembershipPayment(account._id, accountType, plan, payment.paymentDate);
  res.json(paymentResponse(payment, plan));
});
