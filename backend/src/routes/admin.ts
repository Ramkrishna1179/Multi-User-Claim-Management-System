import express from 'express';
import {
  getAdminSettings,
  updateAdminSettings,
  getAdminStats,
  testAdminSettings
} from '../controllers/adminController';
import { auth, requireRole } from '../middlewares/auth';

const router = express.Router();

// All routes require authentication and admin role
router.use(auth);
router.use(requireRole(['admin']));

// Admin settings routes
router.get('/settings', getAdminSettings);
router.put('/settings', updateAdminSettings);

// Test endpoint
router.get('/test-settings', testAdminSettings);

// Admin dashboard stats
router.get('/stats', getAdminStats);

export default router; 