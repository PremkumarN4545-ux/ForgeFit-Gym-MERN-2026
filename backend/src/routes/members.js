import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createMember,
  deleteMember,
  getMember,
  getMemberPayments,
  getRegisteredUser,
  listRegisteredUsers,
  listMembers,
  resetMemberPassword,
  resetRegisteredUserPassword,
  setMemberAccountStatus,
  setRegisteredUserAccountStatus,
  updateMember,
} from '../controllers/memberController.js';

const router = Router();
router.use(protect);

router.get('/registered-users', listRegisteredUsers);
router.get('/registered-users/:id', getRegisteredUser);
router.post('/registered-users/:id/reset-password', resetRegisteredUserPassword);
router.patch('/registered-users/:id/account-status', setRegisteredUserAccountStatus);
router.route('/').get(listMembers).post(createMember);
router.get('/:id/payments', getMemberPayments);
router.post('/:id/reset-password', resetMemberPassword);
router.patch('/:id/account-status', setMemberAccountStatus);
router.route('/:id').get(getMember).put(updateMember).delete(deleteMember);

export default router;
