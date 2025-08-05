import { Request, Response } from 'express';
import AdminSettings from '../models/AdminSettings';
import { IUser } from '../models/User';

// Extend Request interface to include user
interface AuthRequest extends Request {
  user?: IUser;
}

// Get current admin settings (public - any authenticated user can access)
export const getCurrentSettings = async (req: Request, res: Response) => {
  try {
    const settings = await AdminSettings.findOne({ isActive: true });
    
    if (!settings) {
      // Return default settings if none exist
      return res.json({
        success: true,
        settings: {
          ratePerLike: 1,
          ratePer100Views: 50
        }
      });
    }

    return res.json({
      success: true,
      settings: {
        ratePerLike: settings.ratePerLike,
        ratePer100Views: settings.ratePer100Views
      }
    });
  } catch (error) {
    console.error('Error fetching current settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching current settings'
    });
  }
};

// Get admin settings
export const getAdminSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await AdminSettings.findOne({ isActive: true })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    
    if (!settings) {
      // Return default settings if none exist
      return res.json({
        success: true,
        settings: {
          ratePerLike: 1,
          ratePer100Views: 50
        }
      });
    }

    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching admin settings'
    });
  }
};

// Update admin settings
export const updateAdminSettings = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Update admin settings request:', {
      body: req.body,
      user: req.user?._id,
      userRole: req.user?.role
    });

    const { ratePerLike, ratePer100Views } = req.body;

    // Validate input
    if (typeof ratePerLike !== 'number' || typeof ratePer100Views !== 'number') {
      console.log('Validation failed - invalid types:', { ratePerLike, ratePer100Views });
      return res.status(400).json({
        success: false,
        message: 'ratePerLike and ratePer100Views must be numbers'
      });
    }

    if (ratePerLike < 0 || ratePer100Views < 0) {
      console.log('Validation failed - negative values:', { ratePerLike, ratePer100Views });
      return res.status(400).json({
        success: false,
        message: 'Rates cannot be negative'
      });
    }

    console.log('Starting admin settings update...');

    // Check if user exists and has admin role
    if (!req.user?._id) {
      console.log('No user found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // First, check existing settings
    console.log('Checking existing settings...');
    const existingSettings = await AdminSettings.find({ isActive: true });
    console.log('Existing active settings count:', existingSettings.length);

    // Deactivate all existing settings
    console.log('Deactivating existing settings...');
    if (existingSettings.length > 0) {
      const updateResult = await AdminSettings.updateMany(
        { isActive: true },
        { isActive: false, updatedAt: new Date(), updatedBy: req.user._id }
      );
      console.log('Update result:', updateResult);
    }

    // Then create new settings
    console.log('Creating new settings...');
    const newSettings = new AdminSettings({
      ratePerLike,
      ratePer100Views,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      isActive: true
    });

    console.log('Saving new settings...');
    await newSettings.save();
    console.log('Settings saved successfully');

    // Populate user details for response
    console.log('Populating user details...');
    await newSettings.populate('createdBy', 'name');
    await newSettings.populate('updatedBy', 'name');

    console.log('Admin settings updated successfully');
    return res.json({
      success: true,
      message: 'Admin settings updated successfully',
      settings: newSettings
    });
  } catch (error: any) {
    console.error('Error updating admin settings:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      code: error?.code
    });
    return res.status(500).json({
      success: false,
      message: `Error updating admin settings: ${error?.message || 'Unknown error'}`
    });
  }
};

// Test endpoint to check if AdminSettings model works
export const testAdminSettings = async (req: Request, res: Response) => {
  try {
    console.log('Testing AdminSettings model...');
    
    // Try to find existing settings
    const existingSettings = await AdminSettings.find({});
    console.log('Existing settings count:', existingSettings.length);
    
    // Try to create a test setting
    const testSetting = new AdminSettings({
      ratePerLike: 0.01,
      ratePer100Views: 0.50,
      createdBy: '507f1f77bcf86cd799439011', // Test ObjectId
      updatedBy: '507f1f77bcf86cd799439011', // Test ObjectId
      isActive: false // Set to false to avoid unique constraint
    });
    
    await testSetting.save();
    console.log('Test setting created successfully');
    
    // Clean up
    await AdminSettings.deleteOne({ _id: testSetting._id });
    console.log('Test setting cleaned up');
    
    return res.json({
      success: true,
      message: 'AdminSettings model test successful',
      existingSettingsCount: existingSettings.length
    });
  } catch (error: any) {
    console.error('AdminSettings test error:', error);
    return res.status(500).json({
      success: false,
      message: `AdminSettings test failed: ${error?.message || 'Unknown error'}`,
      error: error?.message
    });
  }
};

// Get admin dashboard stats
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const Claim = require('../models/Claim').default;
    const User = require('../models/User').default;
    const Post = require('../models/Post').default;

    // Get counts
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalPosts = await Post.countDocuments({ isActive: true });
    const totalClaims = await Claim.countDocuments({ isActive: true });
    const pendingClaims = await Claim.countDocuments({ 
      isActive: true, 
      status: 'pending' 
    });
    const approvedClaims = await Claim.countDocuments({ 
      isActive: true, 
      status: { $in: ['account_approved', 'admin_approved', 'settled'] } 
    });
    const rejectedClaims = await Claim.countDocuments({ 
      isActive: true, 
      status: 'user_rejected' 
    });

    // Get total earnings and deductions - calculate from all claims
    const earningsData = await Claim.aggregate([
      { $match: { isActive: true } },
      { 
        $group: { 
          _id: null, 
          totalEarnings: { $sum: '$calculatedEarnings' },
          totalDeductions: { $sum: '$deductionAmount' }
        } 
      }
    ]);

    // Get earnings and deductions for approved/settled claims only
    const approvedEarningsData = await Claim.aggregate([
      { $match: { isActive: true, status: { $in: ['account_approved', 'admin_approved', 'settled'] } } },
      { 
        $group: { 
          _id: null, 
          approvedEarnings: { $sum: '$calculatedEarnings' },
          approvedDeductions: { $sum: '$deductionAmount' }
        } 
      }
    ]);

    // Get top creators based on total earnings
    const topCreators = await Claim.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$userId',
          totalClaims: { $sum: 1 },
          totalEarnings: { $sum: '$calculatedEarnings' },
          totalDeductions: { $sum: '$deductionAmount' }
        }
      },
      {
        $addFields: {
          netEarnings: { $subtract: ['$totalEarnings', '$totalDeductions'] }
        }
      },
      { $sort: { netEarnings: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ['$user.name', 0] },
          totalClaims: 1,
          totalEarnings: 1,
          totalDeductions: 1,
          netEarnings: 1
        }
      }
    ]);

    // Calculate average processing time (simplified - using creation date to now)
    const averageProcessingTime = 0; // TODO: Implement actual processing time calculation

    const stats = {
      totalUsers,
      totalPosts,
      totalClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      totalEarnings: earningsData[0]?.totalEarnings || 0,
      totalDeductions: earningsData[0]?.totalDeductions || 0,
      approvedEarnings: approvedEarningsData[0]?.approvedEarnings || 0,
      approvedDeductions: approvedEarningsData[0]?.approvedDeductions || 0,
      averageProcessingTime,
      topCreators
    };

    console.log('Admin stats calculated:', {
      totalClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims,
      totalEarnings: stats.totalEarnings,
      totalDeductions: stats.totalDeductions,
      topCreatorsCount: topCreators.length
    });

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin statistics'
    });
  }
}; 