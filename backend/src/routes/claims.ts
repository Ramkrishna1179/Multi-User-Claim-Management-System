import express from 'express';
import {
  submitClaim,
  checkPostsAlreadyClaimed,
  getUserClaims,
  getAllClaims,
  getClaimById,
  applyDeduction,
  respondToDeduction,
  accountApprove,
  accountReject,
  adminApprove,
  lockClaim,
  unlockClaim,
  getClaimStats
} from '../controllers/claimController';
import { auth, requireRole } from '../middlewares/auth';
import { uploadProofFiles } from '../middlewares/upload';

const router = express.Router();

// All routes require authentication
router.use(auth);

// User routes
router.post('/check-posts', requireRole(['user']), checkPostsAlreadyClaimed);
router.post('/', requireRole(['user']), uploadProofFiles, submitClaim);
router.get('/user', requireRole(['user']), getUserClaims);
router.get('/stats', getClaimStats);

// Review routes (Account role)
router.get('/', requireRole(['account', 'admin']), getAllClaims);
router.get('/:id', getClaimById);

// Specific action routes (order matters - specific before parameterized)
router.post('/:id/respond', requireRole(['user']), respondToDeduction);
router.post('/:id/deduction', requireRole(['account']), applyDeduction);
router.post('/:id/approve', requireRole(['account']), accountApprove);
router.post('/:id/reject', requireRole(['account']), accountReject);
router.post('/:id/final-approve', requireRole(['admin']), adminApprove);

// Locking routes
router.post('/:id/lock', lockClaim);
router.post('/:id/unlock', unlockClaim);

export default router; 