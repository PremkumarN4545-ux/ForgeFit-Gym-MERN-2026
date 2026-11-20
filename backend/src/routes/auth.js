import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getMemberDashboard, login, loginMember, me, registerMember } from '../controllers/authController.js';
import { identify, protectMember } from '../middleware/auth.js';
import {
  createMembershipOrder,
  submitMemberPayment,
  verifyMembershipPayment,
} from '../controllers/paymentController.js';

const router = Router();

// Slow down password guessing: 20 login attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again in 15 minutes.' },
});

router.post('/login', loginLimiter, login);
router.post('/member/login', loginLimiter, loginMember);
router.post('/member/register', registrationLimiter, registerMember);
router.get('/member/dashboard', protectMember, getMemberDashboard);
router.post('/member/payments', protectMember, submitMemberPayment);
router.post('/member/payments/order', protectMember, createMembershipOrder);
router.post('/member/payments/verify', protectMember, verifyMembershipPayment);
router.get('/me', identify, me);

export default router;
