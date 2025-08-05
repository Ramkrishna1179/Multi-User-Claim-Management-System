import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  userId: mongoose.Types.ObjectId;
  contentText: string;
  imageUrl?: string;
  likeCount: number;
  viewCount: number;
  tags: string[];
  createdAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedAt: Date;
  updatedBy: mongoose.Types.ObjectId;
  isActive: boolean;
}

const postSchema = new Schema<IPost>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  contentText: {
    type: String,
    required: [true, 'Content text is required'],
    trim: true,
    maxlength: [1000, 'Content text cannot exceed 1000 characters']
  },
  imageUrl: {
    type: String,
    default: null
  },
  likeCount: {
    type: Number,
    default: 0,
    min: [0, 'Like count cannot be negative']
  },
  viewCount: {
    type: Number,
    default: 0,
    min: [0, 'View count cannot be negative']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [200, 'Tag cannot exceed 200 characters']
  }],
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
postSchema.index({ userId: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ isActive: 1 });

// Virtual for total engagement
postSchema.virtual('totalEngagement').get(function() {
  return this.likeCount + this.viewCount;
});

export default mongoose.model<IPost>('Post', postSchema); 