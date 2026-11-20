import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MEMBER_STATUSES } from '../utils/constants.js';

const membershipSchema = new mongoose.Schema(
  {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    lastMembershipPaymentAt: { type: Date },
    status: { type: String, enum: MEMBER_STATUSES, default: 'Active' },
  },
  { _id: false }
);

const memberProfileSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    gender: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    joiningDate: { type: Date, required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    lastMembershipPaymentAt: { type: Date },
    status: { type: String, enum: MEMBER_STATUSES, default: 'Active', required: true },
    sourceMember: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    recordCreatedAt: { type: Date },
    archivedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 20 },
    password: { type: String, minlength: 8, maxlength: 128, select: false },
    role: { type: String, enum: ['member'], default: 'member', required: true, immutable: true },
    accountStatus: { type: String, enum: ['Active', 'Inactive'], default: 'Active', required: true },
    legacyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', unique: true, sparse: true },
    membership: { type: membershipSchema, default: undefined },
    memberProfile: { type: memberProfileSchema, default: undefined },
  },
  { timestamps: true }
);

userSchema.index({ 'memberProfile.memberId': 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

const User = mongoose.model('User', userSchema);

export async function syncExpiredUserMemberships(filter = {}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await Promise.all([
    User.updateMany(
      { ...filter, 'membership.status': 'Active', 'membership.expiryDate': { $lt: today } },
      { $set: { 'membership.status': 'Expired' } }
    ),
    User.updateMany(
      { ...filter, 'memberProfile.status': 'Active', 'memberProfile.expiryDate': { $lt: today } },
      { $set: { 'memberProfile.status': 'Expired' } }
    ),
  ]);
}

export default User;
