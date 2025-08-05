import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminSettings extends Document {
  ratePerLike: number;
  ratePer100Views: number;
  createdAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  isActive: boolean;
}

const adminSettingsSchema = new Schema<IAdminSettings>({
  ratePerLike: {
    type: Number,
    required: [true, 'Rate per like is required'],
    min: [0, 'Rate per like cannot be negative'],
    default: 0.01
  },
  ratePer100Views: {
    type: Number,
    required: [true, 'Rate per 100 views is required'],
    min: [0, 'Rate per 100 views cannot be negative'],
    default: 0.50
  },
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

// Ensure only one active settings record
adminSettingsSchema.index({ isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true }
});

export default mongoose.model<IAdminSettings>('AdminSettings', adminSettingsSchema); 