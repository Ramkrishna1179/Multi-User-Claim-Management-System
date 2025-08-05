import Claim, { IClaim } from '../models/Claim';
import Post from '../models/Post';
import AdminSettings from '../models/AdminSettings';
import mongoose from 'mongoose';

// Global variable to store Socket.IO instance
let ioInstance: any = null;

// Function to set the Socket.IO instance
export const setSocketIO = (io: any) => {
  console.log('Setting Socket.IO instance:', !!io);
  ioInstance = io;
};

export class ClaimService {
  // Calculate earnings based on likes and views
  static async calculateEarnings(postIds: mongoose.Types.ObjectId[]): Promise<number> {
    try {
      const posts = await Post.find({ _id: { $in: postIds } });
      const settings = await AdminSettings.findOne({ isActive: true });
      
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      let totalEarnings = 0;
      
      for (const post of posts) {
        const likeEarnings = post.likeCount * settings.ratePerLike;
        const viewEarnings = (post.viewCount / 100) * settings.ratePer100Views;
        totalEarnings += likeEarnings + viewEarnings;
      }

      return Math.round(totalEarnings * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      throw new Error(`Error calculating earnings: ${error}`);
    }
  }

  // Create new claim
  static async createClaim(claimData: Partial<IClaim>): Promise<IClaim> {
    try {
      // Validate input data
      if (!claimData.userId || !claimData.postIds || claimData.postIds.length === 0) {
        throw new Error('❌ Invalid claim data: User ID and post IDs are required');
      }

      // Convert post IDs to strings for comparison
      const newPostIds = claimData.postIds!.map(id => id.toString());
      
      // Remove duplicates from post IDs
      const uniquePostIds = [...new Set(newPostIds)];
      if (uniquePostIds.length !== newPostIds.length) {
        throw new Error('❌ Duplicate posts detected in your selection. Please remove duplicate posts and try again.');
      }

      // SIMPLE DUPLICATE PREVENTION: Check if ANY claim exists for these postIds
      // Since each post has a unique MongoDB ObjectId, we just check if any claim contains these postIds
      
      // Check if any existing claim contains any of the new postIds
      const existingClaimsWithSamePosts = await Claim.find({
        postIds: { $in: claimData.postIds }
      }).populate('postIds', 'contentText');

      if (existingClaimsWithSamePosts.length > 0) {
        // Find which specific posts are already claimed
        const alreadyClaimedPostIds = new Set<string>();
        const alreadyClaimedPostDetails: string[] = [];
        
        existingClaimsWithSamePosts.forEach(existingClaim => {
          existingClaim.postIds.forEach(postId => {
            const postIdStr = postId.toString();
            if (newPostIds.includes(postIdStr)) {
              alreadyClaimedPostIds.add(postIdStr);
              // Get post content for better error message
              const post = postId as any;
              const content = post?.contentText ? post.contentText.substring(0, 50) + '...' : `Post ${postIdStr}`;
              alreadyClaimedPostDetails.push(`${postIdStr} (${content}) - Status: ${existingClaim.status}`);
            }
          });
        });

        const claimedPostsList = Array.from(alreadyClaimedPostDetails).join(', ');
        throw new Error(`❌ Duplicate Claim Detected: The following posts are already claimed: ${claimedPostsList}. Each post can only be claimed once.`);
      }

      // Additional validation: Check if any of the posts belong to another user
      const posts = await Post.find({ _id: { $in: claimData.postIds } });
      const invalidPosts = posts.filter(post => post.userId.toString() !== claimData.userId!.toString());
      
      if (invalidPosts.length > 0) {
        const invalidPostIds = invalidPosts.map(post => post._id.toString()).join(', ');
        throw new Error(`❌ Invalid Posts: Posts with IDs ${invalidPostIds} do not belong to you. You can only claim earnings for your own posts.`);
      }

      const earnings = await this.calculateEarnings(claimData.postIds!);
      
      const claim = new Claim({
        ...claimData,
        calculatedEarnings: earnings,
        status: 'pending',
        history: [{
          action: 'submitted',
          by: claimData.createdBy!,
          timestamp: new Date()
        }]
      });

      const savedClaim = await claim.save();

      // Emit socket event for new claim notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `New claim submitted for review`,
          timestamp: new Date()
        };
        console.log('Emitting new_claim:', notificationData);
        
        // Emit to account reviewers and admins
        ioInstance.to('role_account').to('role_admin').emit('new_claim', notificationData);
        
        // Also emit to all users
        ioInstance.emit('new_claim', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error creating claim: ${error}`);
    }
  }

  // Check if posts are already claimed (simple postId-based check)
  static async checkPostsAlreadyClaimed(userId: mongoose.Types.ObjectId, postIds: mongoose.Types.ObjectId[]): Promise<{ alreadyClaimed: boolean, conflictingPosts: string[] }> {
    try {
      // Simple check: if any claim contains any of these postIds, they are already claimed
      const existingClaimsWithSamePosts = await Claim.find({
        postIds: { $in: postIds }
      }).populate('postIds', 'contentText');

      if (existingClaimsWithSamePosts.length === 0) {
        return { alreadyClaimed: false, conflictingPosts: [] };
      }

      // Find which specific posts are already claimed
      const conflictingPosts: string[] = [];
      const postIdStrings = postIds.map(id => id.toString());
      
      existingClaimsWithSamePosts.forEach(existingClaim => {
        existingClaim.postIds.forEach(postId => {
          const postIdStr = postId.toString();
          if (postIdStrings.includes(postIdStr)) {
            const post = postId as any;
            const content = post?.contentText ? post.contentText.substring(0, 50) + '...' : `Post ${postIdStr}`;
            conflictingPosts.push(`${postIdStr} (${content}) - Status: ${existingClaim.status}`);
          }
        });
      });

      return { 
        alreadyClaimed: conflictingPosts.length > 0, 
        conflictingPosts: [...new Set(conflictingPosts)]
      };
    } catch (error) {
      throw new Error(`Error checking for existing claims: ${error}`);
    }
  }

  // Get user's claimed post IDs (for filtering out already claimed posts)
  static async getUserClaimedPostIds(userId: mongoose.Types.ObjectId): Promise<string[]> {
    try {
      const claims = await Claim.find({
        userId: userId,
        isActive: true
      }).select('postIds');
      
      const claimedPostIds = new Set<string>();
      claims.forEach(claim => {
        claim.postIds.forEach(postId => {
          claimedPostIds.add(postId.toString());
        });
      });
      
      return Array.from(claimedPostIds);
    } catch (error) {
      throw new Error(`Error getting user's claimed post IDs: ${error}`);
    }
  }

  // Get claims with filters
  static async getClaims(filters: any, page: number = 1, limit: number = 10): Promise<{ claims: IClaim[], total: number }> {
    // Cap limit at 100 for performance
    const cappedLimit = Math.min(limit, 100);
    try {
      const query: any = { isActive: true };

      // Apply filters
      if (filters.userId) query.userId = filters.userId;
      
      // Handle status filter - support comma-separated values
      if (filters.status) {
        if (typeof filters.status === 'string' && filters.status.includes(',')) {
          // Multiple statuses provided as comma-separated string
          const statuses = filters.status.split(',').map((s: string) => s.trim());
          query.status = { $in: statuses };
        } else {
          // Single status
          query.status = filters.status;
        }
      }
      
      if (filters.reviewedBy) query.reviewedBy = filters.reviewedBy;
      if (filters.finalApprovedBy) query.finalApprovedBy = filters.finalApprovedBy;
      if (filters.hasDeduction) query.deductionAmount = { $gt: 0 };
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      // Earnings range filter
      if (filters.minEarnings || filters.maxEarnings) {
        query.calculatedEarnings = {};
        if (filters.minEarnings) query.calculatedEarnings.$gte = filters.minEarnings;
        if (filters.maxEarnings) query.calculatedEarnings.$lte = filters.maxEarnings;
      }

      const skip = (page - 1) * cappedLimit;
      
      const [claims, total] = await Promise.all([
        Claim.find(query)
          .populate('userId', 'name email')
          .populate('reviewedBy', 'name')
          .populate('finalApprovedBy', 'name')
          .populate('postIds', cappedLimit > 50 ? '_id' : 'contentText likeCount viewCount') // Reduce populate for large datasets
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(cappedLimit),
        Claim.countDocuments(query)
      ]);

      return { claims, total };
    } catch (error) {
      throw new Error(`Error fetching claims: ${error}`);
    }
  }

  // Apply deduction to claim
  static async applyDeduction(claimId: string, deductionData: { amount: number, reason: string }, reviewerId: mongoose.Types.ObjectId): Promise<IClaim> {
    try {
      const claim = await Claim.findById(claimId).populate('userId', 'name email');
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'pending') {
        throw new Error('Claim can only have deduction applied when status is pending');
      }

      // Validate deduction amount
      if (deductionData.amount <= 0) {
        throw new Error('Deduction amount must be greater than 0');
      }

      if (deductionData.amount >= claim.calculatedEarnings) {
        throw new Error('Deduction amount cannot be greater than or equal to calculated earnings');
      }

      // Clean up any invalid history entries before adding new one
      if (claim.history && claim.history.length > 0) {
        claim.history = claim.history.filter(entry => {
          const validActions = ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'];
          return validActions.includes(entry.action);
        });
      }

      // Add to history manually
      claim.history.push({
        action: 'deduction_applied',
        by: reviewerId,
        timestamp: new Date(),
        note: `Deduction applied: ${deductionData.reason}`
      });

      claim.deductionAmount = deductionData.amount;
      claim.deductionReason = deductionData.reason;
      claim.status = 'deducted';
      claim.reviewedBy = reviewerId;
      claim.updatedBy = reviewerId;

      const savedClaim = await claim.save();

      // Emit socket event for deduction notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const finalAmount = savedClaim.calculatedEarnings - savedClaim.deductionAmount;
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `Deduction applied to your claim: ${deductionData.reason}. Final amount: ₹${finalAmount}`,
          updatedBy: reviewerId,
          timestamp: new Date(),
          deductionAmount: deductionData.amount,
          deductionReason: deductionData.reason,
          finalAmount: finalAmount,
          claim: savedClaim // Send full claim data for modal
        };
        console.log('Emitting deduction_applied:', notificationData);
        
        // Emit to specific user
        ioInstance.to(`user_${savedClaim.userId}`).emit('deduction_applied', notificationData);
        
        // Also emit to all users for real-time updates
        ioInstance.emit('claim_status_changed', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error applying deduction: ${error}`);
    }
  }

  // User response to deduction
  static async respondToDeduction(claimId: string, accepted: boolean, userId: mongoose.Types.ObjectId): Promise<IClaim> {
    try {
      const claim = await Claim.findById(claimId).populate('userId', 'name email');
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'deducted') {
        throw new Error('Claim can only be responded to when status is deducted');
      }

      // Fix user ID comparison - handle both ObjectId and string
      const claimUserId = claim.userId._id || claim.userId;
      const userIdStr = userId.toString();
      const claimUserIdStr = claimUserId.toString();
      
      console.log('User ID comparison:', {
        providedUserId: userIdStr,
        claimUserId: claimUserIdStr,
        match: userIdStr === claimUserIdStr
      });

      if (userIdStr !== claimUserIdStr) {
        throw new Error('Unauthorized to respond to this claim');
      }

      // Clean up any invalid history entries before adding new one
      if (claim.history && claim.history.length > 0) {
        claim.history = claim.history.filter(entry => {
          const validActions = ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'];
          return validActions.includes(entry.action);
        });
      }

      // Add to history manually
      claim.history.push({
        action: accepted ? 'user_accepted' : 'user_rejected',
        by: userId,
        timestamp: new Date(),
        note: accepted ? 'User accepted the deduction' : 'User rejected the deduction'
      });

      // Set status based on user response
      if (accepted) {
        // User accepted deduction → Move to Admin for final approval
        claim.status = 'user_accepted';
      } else {
        // User rejected deduction → Loop back to Account for re-review
        claim.status = 'user_rejected';
        // Clear the deduction data since user rejected it
        claim.deductionAmount = 0;
        claim.deductionReason = '';
      }
      
      claim.updatedBy = userId;

      const savedClaim = await claim.save();

      // Emit socket event for real-time notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const action = accepted ? 'accepted' : 'rejected';
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `User ${action} the deduction. ${accepted ? 'Claim moved to Admin for final approval.' : 'Claim returned to Account for re-review.'}`,
          updatedBy: userId,
          timestamp: new Date(),
          action: action
        };
        console.log('Emitting deduction_response:', notificationData);
        
        // Emit to all users (Account and Admin need to know)
        ioInstance.emit('deduction_response', notificationData);
        ioInstance.emit('claim_status_changed', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error responding to deduction: ${error}`);
    }
  }

  // Account approval
  static async accountApprove(claimId: string, reviewerId: mongoose.Types.ObjectId): Promise<IClaim> {
    try {
      const claim = await Claim.findById(claimId).populate('userId', 'name email');
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'pending' && claim.status !== 'user_rejected') {
        throw new Error('Claim can only be approved when status is pending or user_rejected');
      }

      // Clean up any invalid history entries before adding new one
      if (claim.history && claim.history.length > 0) {
        claim.history = claim.history.filter(entry => {
          const validActions = ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'];
          return validActions.includes(entry.action);
        });
      }

      // Add to history manually
      claim.history.push({
        action: 'account_approved',
        by: reviewerId,
        timestamp: new Date(),
        note: 'Claim approved by account reviewer'
      });

      claim.status = 'account_approved';
      claim.reviewedBy = reviewerId;
      claim.updatedBy = reviewerId;

      const savedClaim = await claim.save();

      // Emit socket event for real-time notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `Claim approved by account reviewer`,
          updatedBy: reviewerId,
          timestamp: new Date()
        };
        console.log('Emitting claim_status_changed:', notificationData);
        
        // Emit to all users
        ioInstance.emit('claim_status_changed', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error approving claim: ${error}`);
    }
  }

  // Account reject claim
  static async accountReject(claimId: string, reviewerId: mongoose.Types.ObjectId, reason: string): Promise<IClaim> {
    try {
      const claim = await Claim.findById(claimId).populate('userId', 'name email');
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'pending' && claim.status !== 'user_rejected') {
        throw new Error('Claim cannot be rejected in current status');
      }

      // Clean up any invalid history entries before adding new one
      if (claim.history && claim.history.length > 0) {
        claim.history = claim.history.filter(entry => {
          const validActions = ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'];
          return validActions.includes(entry.action);
        });
      }

      // Add to history manually
      claim.history.push({
        action: 'user_rejected',
        by: reviewerId,
        timestamp: new Date(),
        note: reason
      });

      claim.status = 'user_rejected';
      claim.reviewedBy = reviewerId;
      claim.updatedBy = reviewerId;
      claim.deductionReason = reason; // Use deductionReason field for rejection reason

      const savedClaim = await claim.save();

      // Emit socket event for real-time notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `Claim rejected by account reviewer: ${reason}`,
          updatedBy: reviewerId,
          timestamp: new Date(),
          reason: reason
        };
        console.log('Emitting claim_status_changed:', notificationData);
        
        // Emit to all users
        ioInstance.emit('claim_status_changed', notificationData);
        
        // Also emit to specific user
        ioInstance.to(`user_${savedClaim.userId}`).emit('claim_status_changed', notificationData);
        
        // Emit to admin users
        ioInstance.to('role_admin').emit('claim_status_changed', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error rejecting claim: ${error}`);
    }
  }

  // Admin final approval
  static async adminApprove(claimId: string, adminId: mongoose.Types.ObjectId): Promise<IClaim> {
    try {
      const claim = await Claim.findById(claimId).populate('userId', 'name email');
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.status !== 'account_approved' && claim.status !== 'user_accepted') {
        throw new Error('Claim can only be finally approved when status is account_approved or user_accepted');
      }

      // Clean up any invalid history entries before adding new one
      if (claim.history && claim.history.length > 0) {
        claim.history = claim.history.filter(entry => {
          const validActions = ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'];
          return validActions.includes(entry.action);
        });
      }

      // Add to history manually
      claim.history.push({
        action: 'admin_approved',
        by: adminId,
        timestamp: new Date(),
        note: 'Claim finally approved by admin'
      });

      claim.status = 'admin_approved';
      claim.finalApprovedBy = adminId;
      claim.updatedBy = adminId;

      const savedClaim = await claim.save();

      // Emit socket event for real-time notification
      console.log('Socket notification - ioInstance:', !!ioInstance);
      if (ioInstance) {
        const notificationData = {
          claimId: savedClaim._id,
          status: savedClaim.status,
          userId: savedClaim.userId,
          message: `Claim finally approved and settled by admin`,
          updatedBy: adminId,
          timestamp: new Date()
        };
        console.log('Emitting claim_status_changed:', notificationData);
        
        // Emit to all users
        ioInstance.emit('claim_status_changed', notificationData);
      } else {
        console.log('Socket notification failed - ioInstance not available');
      }

      return savedClaim;
    } catch (error) {
      throw new Error(`Error approving claim: ${error}`);
    }
  }

  // Lock claim for editing
  static async lockClaim(claimId: string, userId: mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      // Check if already locked by someone else
      if (claim.lockedBy && claim.lockedBy.toString() !== userId.toString()) {
        const lockAge = Date.now() - claim.lockTimestamp!.getTime();
        // If lock is older than 30 minutes, allow override
        if (lockAge < 30 * 60 * 1000) {
          return false;
        }
      }

      claim.lockedBy = userId;
      claim.lockTimestamp = new Date();
      await claim.save();

      return true;
    } catch (error) {
      throw new Error(`Error locking claim: ${error}`);
    }
  }

  // Unlock claim
  static async unlockClaim(claimId: string, userId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const claim = await Claim.findById(claimId);
      if (!claim) {
        throw new Error('Claim not found');
      }

      if (claim.lockedBy?.toString() === userId.toString()) {
        claim.lockedBy = undefined;
        claim.lockTimestamp = undefined;
        await claim.save();
      }
    } catch (error) {
      throw new Error(`Error unlocking claim: ${error}`);
    }
  }
}

export default ClaimService; 