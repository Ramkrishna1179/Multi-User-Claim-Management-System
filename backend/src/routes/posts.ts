import express from 'express';
import {
  createPost,
  getUserPosts,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  incrementViews,
  incrementLikes
} from '../controllers/postController';
import { auth, requireRole } from '../middlewares/auth';
import { uploadPostImage } from '../middlewares/upload';

const router = express.Router();

// Public routes
router.get('/', getAllPosts);
router.post('/:id/views', incrementViews);
router.post('/:id/likes', incrementLikes);

// Protected routes
router.post('/', auth, uploadPostImage, createPost);
router.get('/user', auth, getUserPosts);
router.get('/:id', getPostById);
router.put('/:id', auth, uploadPostImage, updatePost);
router.delete('/:id', auth, deletePost);

export default router; 