import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ClaimService from '../services/claimService';
import Claim from '../models/Claim';
import { IUser } from '../models/User';

interface AuthRequest extends Request {
  user?: IUser;
}

export const submitClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    let { postIds } = req.body;
    const proofFileUrls = req.files ? (req.files as Express.Multer.File[]).map(file => `/uploads/${file.filename}`) : [];

    // Parse postIds if it's a JSON string
    if (typeof postIds === 'string') {
      try {
        postIds = JSON.parse(postIds);
      } catch (error) {
        res.status(400).json({ message: 'Invalid postIds format' });
        return;
      }
    }

    if (!postIds || postIds.length === 0) {
      res.status(400).json({ message: 'At least one post is required' });
      return;
    }

    if (proofFileUrls.length === 0) {
      res.status(400).json({ message: 'At least one proof file is required' });
      return;
    }

    const claimData = {
      userId: req.user._id,
      postIds,
      proofFileUrls,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const claim = await ClaimService.createClaim(claimData);

    res.status(201).json({
      success: true,
      claim: {
        id: claim._id,
        calculatedEarnings: claim.calculatedEarnings,
        status: claim.status,
        createdAt: claim.createdAt
      }
    });
      } catch (error: any) {
      console.error('Submit claim error:', error);
      
      // Handle different types of validation errors
      if (error.name === 'DuplicateKeyError') {
        res.status(400).json({ message: error.message });
      } else if (error.message && error.message.includes('❌')) {
        // Our custom validation errors start with ❌
        res.status(400).json({ message: error.message });
      } else if (error.message && error.message.includes('Error creating claim:')) {
        // Extract the actual error message from service layer
        const actualMessage = error.message.replace('Error creating claim: ', '');
        if (actualMessage.includes('❌')) {
          res.status(400).json({ message: actualMessage });
        } else {
          res.status(500).json({ message: 'Server error while submitting claim' });
        }
      } else if (error.code === 11000) {
        // MongoDB duplicate key error
        res.status(400).json({ message: '❌ Duplicate Claim Detected: One or more posts in this claim are already included in an active claim. Please check your selection and try again.' });
      } else {
        res.status(500).json({ message: 'Server error while submitting claim' });
      }
    }
};

export const checkPostsAlreadyClaimed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { postIds } = req.body;
    
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      res.status(400).json({ message: 'Post IDs are required' });
      return;
    }

    const userId = req.user._id;
    const postObjectIds = postIds.map((id: string) => new mongoose.Types.ObjectId(id));
    
    const result = await ClaimService.checkPostsAlreadyClaimed(userId, postObjectIds);
    
    res.json({
      success: true,
      alreadyClaimed: result.alreadyClaimed,
      conflictingPosts: result.conflictingPosts
    });
  } catch (error: any) {
    console.error('Check posts already claimed error:', error);
    res.status(500).json({ message: 'Server error while checking posts' });
  }
};

export const getUserClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const filters = { userId: req.user._id };
    const { claims, total } = await ClaimService.getClaims(filters, page, limit);

    res.json({
      success: true,
      claims,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user claims error:', error);
    res.status(500).json({ message: 'Server error while fetching claims' });
  }
};

export const getAllClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); 
    const filters: any = {};

    // Apply filters based on query parameters
    if (req.query.status) filters.status = req.query.status;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.minEarnings) filters.minEarnings = parseFloat(req.query.minEarnings as string);
    if (req.query.maxEarnings) filters.maxEarnings = parseFloat(req.query.maxEarnings as string);
    if (req.query.hasDeduction) filters.hasDeduction = req.query.hasDeduction === 'true';

    // Role-based filtering
    if (req.user.role === 'account') {
      // Account users can see claims they've reviewed OR claims that are pending/deducted
      // Don't filter by reviewedBy for account users - they should see all claims
    } else if (req.user.role === 'admin') {
      // Admin users can see all claims
    }

    console.log('getAllClaims - User role:', req.user.role);
    console.log('getAllClaims - Filters:', filters);
    
    const { claims, total } = await ClaimService.getClaims(filters, page, limit);
    
    console.log('getAllClaims - Found claims:', claims.length);
    console.log('getAllClaims - Claims statuses:', claims.map(c => c.status));
    console.log('getAllClaims - Total count:', total);
    console.log('getAllClaims - Page:', page, 'Limit:', limit);
    console.log('getAllClaims - Calculated total pages:', Math.ceil(total / limit));

    res.json({
      success: true,
      claims,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all claims error:', error);
    res.status(500).json({ message: 'Server error while fetching claims' });
  }
};

export const getClaimById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const claim = await Claim.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name')
      .populate('finalApprovedBy', 'name')
      .populate('postIds', 'contentText likeCount viewCount imageUrl')
      .populate('lockedBy', 'name');

    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }

    // Check authorization
    if (req.user.role === 'user' && claim.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Not authorized to view this claim' });
      return;
    }

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    console.error('Get claim by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching claim' });
  }
};

export const applyDeduction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'account') {
      res.status(403).json({ message: 'Only account reviewers can apply deductions' });
      return;
    }

    const { deductionAmount, deductionReason } = req.body;

    if (!deductionAmount || !deductionReason) {
      res.status(400).json({ message: 'Deduction amount and reason are required' });
      return;
    }
    const claim = await ClaimService.applyDeduction(
      req.params.id as string,
      { amount: deductionAmount, reason: deductionReason },
      req.user._id
    );

    res.json({
      success: true,
      claim: {
        id: claim._id,
        status: claim.status,
        deductionAmount: claim.deductionAmount,
        deductionReason: claim.deductionReason
      }
    });
  } catch (error) {
    console.error('Apply deduction error:', error);
    res.status(500).json({ message: 'Server error while applying deduction' });
  }
};

export const respondToDeduction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('=== RESPOND TO DEDUCTION DEBUG ===');
    console.log('Request user:', req.user);
    console.log('Request user ID:', req.user?._id);
    console.log('Request user role:', req.user?.role);
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    
    if (!req.user) {
      console.log('No user found in request');
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'user') {
      console.log('User role is not user:', req.user.role);
      res.status(403).json({ message: 'Only users can respond to deductions' });
      return;
    }

    console.log('Respond to deduction - Claim ID:', req.params.id);
    console.log('Respond to deduction - User ID:', req.user._id);
    console.log('Respond to deduction - User role:', req.user.role);

    const { accepted } = req.body;

    if (typeof accepted !== 'boolean') {
      res.status(400).json({ message: 'Accepted field must be a boolean' });
      return;
    }
    
    console.log('Calling ClaimService.respondToDeduction with:', {
      claimId: req.params.id,
      accepted: accepted,
      userId: req.user._id
    });
    
    const claim = await ClaimService.respondToDeduction(
      req.params.id as string,
      accepted,
      req.user._id
    );

    console.log('ClaimService returned:', claim);

    res.json({
      success: true,
      claim: {
        id: claim._id,
        status: claim.status
      }
    });
  } catch (error) {
    console.error('Respond to deduction error:', error);
    res.status(500).json({ message: 'Server error while responding to deduction' });
  }
};

export const accountApprove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'account') {
      res.status(403).json({ message: 'Only account reviewers can approve claims' });
      return;
    }

    console.log('Account approve - Claim ID:', req.params.id);
    console.log('Account approve - User ID:', req.user._id);

    const claim = await ClaimService.accountApprove(req.params.id as string, req.user._id);

    console.log('Account approve - Success, new status:', claim.status);

    res.json({
      success: true,
      claim: {
        id: claim._id,
        status: claim.status
      }
    });
  } catch (error: any) {
    console.error('Account approve error:', error);
    res.status(500).json({ message: error.message || 'Server error while approving claim' });
  }
};

export const accountReject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'account') {
      res.status(403).json({ message: 'Only account reviewers can reject claims' });
      return;
    }

    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ message: 'Rejection reason is required' });
      return;
    }

    console.log('Account reject - Claim ID:', req.params.id);
    console.log('Account reject - User ID:', req.user._id);
    console.log('Account reject - Reason:', reason);

    const claim = await ClaimService.accountReject(req.params.id as string, req.user._id, reason);

    console.log('Account reject - Success, new status:', claim.status);

    res.json({
      success: true,
      claim: {
        id: claim._id,
        status: claim.status
      }
    });
  } catch (error: any) {
    console.error('Account reject error:', error);
    res.status(500).json({ message: error.message || 'Server error while rejecting claim' });
  }
};

export const adminApprove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ message: 'Only admins can finalize claims' });
      return;
    }

    const claim = await ClaimService.adminApprove(req.params.id as string, req.user._id);

    res.json({
      success: true,
      claim: {
        id: claim._id,
        status: claim.status
      }
    });
  } catch (error) {
    console.error('Admin approve error:', error);
    res.status(500).json({ message: 'Server error while finalizing claim' });
  }
};

export const lockClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const locked = await ClaimService.lockClaim(req.params.id as string, req.user._id);

    if (!locked) {
      res.status(409).json({ message: 'Claim is currently being edited by another user' });
      return;
    }

    res.json({
      success: true,
      message: 'Claim locked successfully'
    });
  } catch (error) {
    console.error('Lock claim error:', error);
    res.status(500).json({ message: 'Server error while locking claim' });
  }
};

export const unlockClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    await ClaimService.unlockClaim(req.params.id as string, req.user._id);

    res.json({
      success: true,
      message: 'Claim unlocked successfully'
    });
  } catch (error) {
    console.error('Unlock claim error:', error);
    res.status(500).json({ message: 'Server error while unlocking claim' });
  }
};

export const getClaimStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const filters: any = { isActive: true };
    if (req.user.role === 'user') {
      filters.userId = req.user._id;
    }

    // Use aggregation for better performance - single query instead of multiple count queries
    const stats = await Claim.aggregate([
      { $match: filters },
      {
        $group: {
          _id: null,
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          deducted: {
            $sum: { $cond: [{ $eq: ['$status', 'deducted'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'account_approved'] }, 1, 0] }
          },
          settled: {
            $sum: { $cond: [{ $eq: ['$status', 'settled'] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || { pending: 0, deducted: 0, approved: 0, settled: 0, total: 0 };

    res.json({
      success: true,
      stats: result
    });
  } catch (error) {
    console.error('Get claim stats error:', error);
    res.status(500).json({ message: 'Server error while fetching claim statistics' });
  }
}; 