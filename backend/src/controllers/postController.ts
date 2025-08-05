import { Request, Response } from 'express';
import Post from '../models/Post';
import { IUser } from '../models/User';

interface AuthRequest extends Request {
  user?: IUser;
}

export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { contentText, tags } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const post = new Post({
      userId: req.user._id,
      contentText,
      imageUrl,
      tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await post.save();

    res.status(201).json({
      success: true,
      post: {
        id: post._id,
        contentText: post.contentText,
        imageUrl: post.imageUrl,
        likeCount: post.likeCount,
        viewCount: post.viewCount,
        tags: post.tags,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error while creating post' });
  }
};

export const getUserPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ userId: req.user._id, isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ userId: req.user._id, isActive: true })
    ]);

    res.json({
      success: true,
      posts,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error while fetching posts' });
  }
};

export const getAllPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ isActive: true })
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      posts,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all posts error:', error);
    res.status(500).json({ message: 'Server error while fetching posts' });
  }
};

export const getPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name')
      .where('isActive', true);

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Get post by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching post' });
  }
};

export const updatePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { contentText, tags } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to update this post' });
      return;
    }

    const updateData: any = { updatedBy: req.user._id };
    if (contentText) updateData.contentText = contentText;
    if (imageUrl) updateData.imageUrl = imageUrl;
    if (tags) updateData.tags = tags.split(',').map((tag: string) => tag.trim());

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      post: updatedPost
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error while updating post' });
  }
};

export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    if (post.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to delete this post' });
      return;
    }

    post.isActive = false;
    post.updatedBy = req.user._id;
    await post.save();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error while deleting post' });
  }
};

export const incrementViews = async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      viewCount: post.viewCount
    });
  } catch (error) {
    console.error('Increment views error:', error);
    res.status(500).json({ message: 'Server error while updating views' });
  }
};

export const incrementLikes = async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!post) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      likeCount: post.likeCount
    });
  } catch (error) {
    console.error('Increment likes error:', error);
    res.status(500).json({ message: 'Server error while updating likes' });
  }
}; 