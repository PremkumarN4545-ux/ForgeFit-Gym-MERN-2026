import { Router } from 'express';
import { protect, protectMember } from '../middleware/auth.js';
import {
  createPlan,
  deletePlan,
  getPlan,
  listAvailablePlans,
  listPlans,
  setPlanStatus,
  updatePlan,
} from '../controllers/planController.js';

const router = Router();
router.get('/available', protectMember, listAvailablePlans);
router.use(protect);

router.route('/').get(listPlans).post(createPlan);
router.patch('/:id/status', setPlanStatus);
router.route('/:id').get(getPlan).put(updatePlan).delete(deletePlan);

export default router;
