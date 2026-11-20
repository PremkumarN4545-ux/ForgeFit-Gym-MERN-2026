import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { GENDERS, MEMBER_STATUSES } from '../utils/constants.js';
import { ageFrom, todayUTC } from '../utils/dates.js';

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, minlength: 8, maxlength: 128, select: false },
    gender: { type: String, enum: GENDERS, required: true },
    dateOfBirth: { type: Date, required: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    joiningDate: { type: Date, required: true, default: Date.now },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    lastMembershipPaymentAt: { type: Date },
    status: { type: String, enum: MEMBER_STATUSES, default: 'Active', index: true },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false }, toObject: { virtuals: true } }
);

memberSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

memberSchema.virtual('age').get(function () {
  return this.dateOfBirth ? ageFrom(this.dateOfBirth, todayUTC()) : null;
});

/** Flip Active members whose expiry date has passed to Expired. Run before reads/aggregates. */
export async function syncExpiredMembers() {
  await Member.updateMany(
    { status: 'Active', expiryDate: { $lt: todayUTC() } },
    { $set: { status: 'Expired' } }
  );
}

const Member = mongoose.model('Member', memberSchema);
export default Member;
