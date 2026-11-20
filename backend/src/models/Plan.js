import mongoose from 'mongoose';
import { PLAN_STATUSES } from '../utils/constants.js';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    durationMonths: { type: Number, required: true, min: 1, max: 60, validate: Number.isInteger },
    price: { type: Number, required: true, min: 0 },
    benefits: { type: [String], default: [] },
    status: { type: String, enum: PLAN_STATUSES, default: 'Active' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Case-insensitive unique plan names ("Monthly" == "monthly").
planSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Plan', planSchema);
