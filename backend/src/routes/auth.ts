import express from 'express';
import { register, login, getProfile, updateProfile, changePassword } from '../controllers/authController';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', auth, getProfile);
router.put('/profile/update', auth, updateProfile);
router.put('/change-password', auth, changePassword);

export default router; 