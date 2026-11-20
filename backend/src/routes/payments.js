import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createPayment,
  deletePayment,
  getPayment,
  listPayments,
  updatePayment,
} from '../controllers/paymentController.js';

const router = Router();
router.use(protect);

router.route('/').get(listPayments).post(createPayment);
router.route('/:id').get(getPayment).put(updatePayment).delete(deletePayment);

export default router;
