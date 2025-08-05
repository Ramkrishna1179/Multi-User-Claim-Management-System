import mongoose, { Document, Schema } from 'mongoose';

export interface IClaimHistory {
  action: string;
  by: mongoose.Types.ObjectId;
  timestamp: Date;
  note?: string;
}

export interface IClaim extends Document {
  userId: mongoose.Types.ObjectId;
  postIds: mongoose.Types.ObjectId[];
  proofFileUrls: string[];
  calculatedEarnings: number;
  status: 'pending' | 'deducted' | 'user_accepted' | 'user_rejected' | 'account_approved' | 'admin_approved' | 'settled';
  lockedBy?: mongoose.Types.ObjectId;
  lockTimestamp?: Date;
  deductionAmount: number;
  deductionReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  finalApprovedBy?: mongoose.Types.ObjectId;
  history: IClaimHistory[];
  createdAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  isActive: boolean;
}

const claimHistorySchema = new Schema<IClaimHistory>({
  action: {
    type: String,
    required: true,
    enum: ['submitted', 'deduction_applied', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled']
  },
  by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    maxlength: [500, 'Note cannot exceed 500 characters']
  }
});

const claimSchema = new Schema<IClaim>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  postIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'At least one post is required']
  }],
  proofFileUrls: [{
    type: String,
    required: [true, 'At least one proof file is required']
  }],
  calculatedEarnings: {
    type: Number,
    required: [true, 'Calculated earnings is required'],
    min: [0, 'Earnings cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'deducted', 'user_accepted', 'user_rejected', 'account_approved', 'admin_approved', 'settled'],
    default: 'pending',
    required: true
  },
  lockedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lockTimestamp: {
    type: Date,
    default: null
  },
  deductionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Deduction amount cannot be negative']
  },
  deductionReason: {
    type: String,
    maxlength: [500, 'Deduction reason cannot exceed 500 characters'],
    default: null
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  finalApprovedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  history: [claimHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create indexes
claimSchema.index({ userId: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ createdAt: -1 });
claimSchema.index({ reviewedBy: 1 });
claimSchema.index({ finalApprovedBy: 1 });
claimSchema.index({ isActive: 1 });

// Create compound index for efficient querying
claimSchema.index({ userId: 1, postIds: 1, status: 1, isActive: 1 });

// Note: We cannot use unique indexes on arrays (postIds) directly in MongoDB
// Instead, we'll handle duplicate prevention in the service layer with proper validation

// Add a compound index for efficient duplicate checking
claimSchema.index({ userId: 1, postIds: 1 });

// Virtual for final amount after deductions
claimSchema.virtual('finalAmount').get(function() {
  return this.calculatedEarnings - this.deductionAmount;
});

// Pre-save middleware to handle duplicate key errors
claimSchema.pre('save', function(next) {
  // This will catch any database-level duplicate key errors
  // and provide a more user-friendly error message
  next();
});

// Post-save middleware to handle errors
claimSchema.post('save', function(error: any, doc: any, next: any) {
  if (error) {
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      const duplicateKeyError = new Error('❌ Duplicate Claim Detected: One or more posts in this claim are already included in an active claim. Please check your selection and try again.');
      duplicateKeyError.name = 'DuplicateKeyError';
      return next(duplicateKeyError);
    }
    return next(error);
  }
  next();
});

export default mongoose.model<IClaim>('Claim', claimSchema); 