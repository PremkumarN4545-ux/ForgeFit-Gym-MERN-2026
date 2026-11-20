import mongoose from 'mongoose';
import { CARD_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../utils/constants.js';

// Account and plan details are snapshots so payment history survives account or plan changes.
// Method-specific details. Full card numbers, CVV and PINs are NEVER stored - only safe identifiers.
const paymentDetailsSchema = new mongoose.Schema(
  {
    upiId: { type: String, trim: true, maxlength: 80 },
    cardType: { type: String, enum: CARD_TYPES },
    cardHolderName: { type: String, trim: true, maxlength: 100 },
    cardLast4: { type: String, match: /^\d{4}$/ },
    bankName: { type: String, trim: true, maxlength: 100 },
    accountHolderName: { type: String, trim: true, maxlength: 100 },
    accountLast4: { type: String, match: /^\d{4}$/ },
    otherMethod: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, unique: true },
    gatewayOrderId: { type: String, unique: true, sparse: true },
    receiptNumber: { type: String, unique: true, sparse: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    memberCode: { type: String },
    memberName: { type: String, required: true },
    memberEmail: { type: String, trim: true },
    memberPhone: { type: String, trim: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String, default: '-' },
    planDurationMonths: { type: Number, min: 1 },
    membershipStartDate: { type: Date },
    membershipExpiryDate: { type: Date },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true, index: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionRef: { type: String, trim: true },
    paymentDetails: { type: paymentDetailsSchema, default: undefined },
    // 'Admin' = recorded by staff, 'Member' = submitted by the member from their dashboard.
    source: { type: String, enum: ['Admin', 'Member'], default: 'Admin' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'Paid', index: true },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

paymentSchema.pre('validate', function () {
  if (Boolean(this.member) === Boolean(this.user)) {
    this.invalidate('member', 'Payment must be linked to exactly one member account');
  }
});

// Transaction references must be unique when provided (blank references are allowed).
paymentSchema.index(
  { transactionRef: 1 },
  { unique: true, partialFilterExpression: { transactionRef: { $type: 'string' } } }
);

export default mongoose.model('Payment', paymentSchema);
