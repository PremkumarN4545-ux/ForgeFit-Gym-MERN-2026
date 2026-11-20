import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

async function resolveAccount(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw new ApiError(401, err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid token');
  }

  if (payload.role === 'admin') {
    const admin = await Admin.findById(payload.sub);
    if (!admin) throw new ApiError(401, 'Account no longer exists');
    if (admin.role !== 'admin') throw new ApiError(403, 'Administrator access required');
    return { account: admin, role: 'admin', accountType: 'admin' };
  }

  if (payload.role === 'member') {
    if (payload.accountType === 'user') {
      const user = await User.findById(payload.sub);
      if (!user || user.role !== 'member') throw new ApiError(401, 'Account no longer exists');
      if (user.accountStatus !== 'Active') throw new ApiError(403, 'Member account is disabled');
      if (user.memberProfile?.status === 'Inactive') throw new ApiError(403, 'Member account is disabled');
      if (!user.memberProfile && user.legacyMember) {
        const linkedMember = await Member.findById(user.legacyMember).select('status');
        if (linkedMember?.status === 'Inactive') throw new ApiError(403, 'Member account is disabled');
      }
      return { account: user, role: 'member', accountType: 'user' };
    }

    if (payload.accountType && payload.accountType !== 'legacy-member') {
      throw new ApiError(401, 'Invalid token');
    }
    const migratedUser = await User.findOne({
      legacyMember: payload.sub,
      'memberProfile.memberId': { $exists: true },
    });
    if (migratedUser) {
      if (migratedUser.accountStatus !== 'Active' || migratedUser.memberProfile.status === 'Inactive') {
        throw new ApiError(403, 'Member account is disabled');
      }
      return { account: migratedUser, role: 'member', accountType: 'user' };
    }
    const member = await Member.findById(payload.sub);
    if (!member) throw new ApiError(401, 'Account no longer exists');
    if (member.status === 'Inactive') throw new ApiError(403, 'Member account is disabled');
    return { account: member, role: 'member', accountType: 'legacy-member' };
  }

  throw new ApiError(401, 'Invalid token');
}

export const identify = asyncHandler(async (req, res, next) => {
  const { account, role, accountType } = await resolveAccount(req);
  req.account = account;
  req.accountRole = role;
  req.accountType = accountType;
  next();
});

/** Require a valid token belonging to an existing administrator. */
export const protect = asyncHandler(async (req, res, next) => {
  const { account, role } = await resolveAccount(req);
  if (role !== 'admin') throw new ApiError(403, 'Administrator access required');
  req.admin = account;
  next();
});

/** Require a valid token belonging to an existing gym member. */
export const protectMember = asyncHandler(async (req, res, next) => {
  const { account, role, accountType } = await resolveAccount(req);
  if (role !== 'member') throw new ApiError(403, 'Member access required');
  req.account = account;
  req.accountRole = role;
  req.accountType = accountType;
  req.member = account;
  next();
});
