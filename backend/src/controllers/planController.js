import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { PLAN_STATUSES } from '../utils/constants.js';
import { escapeRegex, isObjectId, queryString, throwIfErrors, validatePlan } from '../utils/validators.js';

const CI = { locale: 'en', strength: 2 }; // case-insensitive collation

async function findPlanOr404(id) {
  if (!isObjectId(id)) throw new ApiError(404, 'Plan not found');
  const plan = await Plan.findById(id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  return plan;
}

async function assertNameFree(name, excludeId) {
  const q = { name };
  if (excludeId) q._id = { $ne: excludeId };
  if (await Plan.findOne(q).collation(CI).select('_id')) {
    throw new ApiError(409, 'A plan with this name already exists', { name: 'A plan with this name already exists' });
  }
}

export const listPlans = asyncHandler(async (req, res) => {
  const filter = {};
  const search = queryString(req.query.search);
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { description: rx }];
  }
  const status = queryString(req.query.status);
  if (PLAN_STATUSES.includes(status)) filter.status = status;

  const [plans, userCounts] = await Promise.all([
    Plan.find(filter).sort({ durationMonths: 1, createdAt: 1 }).lean(),
    User.aggregate([
      {
        $match: {
          $or: [
            { 'memberProfile.memberId': { $exists: true }, 'memberProfile.archivedAt': { $exists: false } },
            { 'memberProfile.memberId': { $exists: false }, 'membership.plan': { $type: 'objectId' } },
          ],
        },
      },
      { $project: { plan: { $ifNull: ['$memberProfile.plan', '$membership.plan'] } } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map();
  for (const count of userCounts) {
    const id = String(count._id);
    countMap.set(id, (countMap.get(id) || 0) + count.count);
  }
  res.json({ data: plans.map((p) => ({ ...p, memberCount: countMap.get(String(p._id)) || 0 })) });
});

export const listAvailablePlans = asyncHandler(async (_req, res) => {
  const data = await Plan.find({ status: 'Active' })
    .select('name description durationMonths price benefits status')
    .sort({ durationMonths: 1, createdAt: 1 })
    .lean();
  res.json({ data });
});

export const getPlan = asyncHandler(async (req, res) => {
  res.json(await findPlanOr404(req.params.id));
});

export const createPlan = asyncHandler(async (req, res) => {
  const { errors, value } = validatePlan(req.body);
  throwIfErrors(errors);
  await assertNameFree(value.name);
  const plan = await Plan.create(value);
  res.status(201).json(plan);
});

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await findPlanOr404(req.params.id);
  const { errors, value } = validatePlan(req.body);
  throwIfErrors(errors);
  await assertNameFree(value.name, plan._id);
  // Changing the duration does not alter expiry dates of members already enrolled.
  plan.set(value);
  await plan.save();
  res.json(plan);
});

export const setPlanStatus = asyncHandler(async (req, res) => {
  const plan = await findPlanOr404(req.params.id);
  const requested = req.body?.status;
  plan.status = PLAN_STATUSES.includes(requested) ? requested : plan.status === 'Active' ? 'Inactive' : 'Active';
  await plan.save();
  res.json(plan);
});

export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await findPlanOr404(req.params.id);
  const assigned = await User.countDocuments({
    $or: [
      {
        'memberProfile.plan': plan._id,
        'memberProfile.archivedAt': { $exists: false },
      },
      {
        'memberProfile.memberId': { $exists: false },
        'membership.plan': plan._id,
      },
    ],
  });
  if (assigned > 0) {
    throw new ApiError(
      409,
      `Cannot delete "${plan.name}": ${assigned} member${assigned === 1 ? ' is' : 's are'} assigned to it. Deactivate the plan instead, or move those members to another plan first.`
    );
  }
  await plan.deleteOne();
  res.json({ message: 'Plan deleted' });
});
