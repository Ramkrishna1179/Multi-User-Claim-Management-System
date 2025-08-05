import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import ClaimService from '../services/claimService';
import mongoose from 'mongoose';

interface AuthenticatedSocket {
  userId: string;
  userRole: string;
  userName: string;
}

export class ClaimSocket {
  private io: SocketIOServer;
  private connectedUsers: Map<string, AuthenticatedSocket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        const user = await User.findById(decoded.userId).select('name role');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data.user = {
          userId: user._id.toString(),
          userRole: user.role,
          userName: user.name
        };

        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const user = socket.data.user as AuthenticatedSocket;
      this.connectedUsers.set(socket.id, user);

      console.log(`User connected: ${user.userName} (${user.userRole})`);

      // Join role-specific rooms
      socket.join(`role_${user.userRole}`);
      socket.join(`user_${user.userId}`);

      // Handle claim locking
      socket.on('lock_claim', async (data: { claimId: string }) => {
        try {
            const locked = await ClaimService.lockClaim(data.claimId, new mongoose.Types.ObjectId(user.userId));
          
          if (locked) {
            // Notify all users about the lock
            this.io.emit('claim_locked', {
              claimId: data.claimId,
              lockedBy: user.userId,
              lockedByName: user.userName,
              timestamp: new Date()
            });
          } else {
            socket.emit('lock_failed', {
              claimId: data.claimId,
              message: 'Claim is currently being edited by another user'
            });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to lock claim' });
        }
      });

      // Handle claim unlocking
      socket.on('unlock_claim', async (data: { claimId: string }) => {
        try {
            await ClaimService.unlockClaim(data.claimId, new mongoose.Types.ObjectId(user.userId));
          
          // Notify all users about the unlock
          this.io.emit('claim_unlocked', {
            claimId: data.claimId,
            unlockedBy: user.userId,
            unlockedByName: user.userName,
            timestamp: new Date()
          });
        } catch (error) {
          socket.emit('error', { message: 'Failed to unlock claim' });
        }
      });

      // Handle claim updates
      socket.on('claim_updated', (data: { claimId: string, status: string }) => {
        // Broadcast to all connected users
        this.io.emit('claim_status_changed', {
          claimId: data.claimId,
          status: data.status,
          updatedBy: user.userId,
          updatedByName: user.userName,
          timestamp: new Date()
        });
      });

      // Handle real-time form updates
      socket.on('form_update', (data: { claimId: string, field: string, value: any }) => {
        // Broadcast to users viewing the same claim
        socket.to(`claim_${data.claimId}`).emit('form_field_updated', {
          claimId: data.claimId,
          field: data.field,
          value: data.value,
          updatedBy: user.userId,
          updatedByName: user.userName,
          timestamp: new Date()
        });
      });

      // Join claim room when viewing a claim
      socket.on('join_claim', (data: { claimId: string }) => {
        socket.join(`claim_${data.claimId}`);
        socket.emit('joined_claim', { claimId: data.claimId });
      });

      // Leave claim room when leaving a claim
      socket.on('leave_claim', (data: { claimId: string }) => {
        socket.leave(`claim_${data.claimId}`);
        socket.emit('left_claim', { claimId: data.claimId });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedUsers.delete(socket.id);
        console.log(`User disconnected: ${user.userName}`);
      });
    });
  }

  // Public methods for broadcasting events
  public broadcastClaimUpdate(claimId: string, status: string, updatedBy: string): void {
    this.io.emit('claim_status_changed', {
      claimId,
      status,
      updatedBy,
      timestamp: new Date()
    });
  }

  public broadcastNewClaim(claim: any): void {
    this.io.to('role_account').to('role_admin').emit('new_claim', {
      claim,
      timestamp: new Date()
    });
  }

  public broadcastDeductionApplied(claimId: string, deductionData: any): void {
    this.io.emit('deduction_applied', {
      claimId,
      deductionData,
      timestamp: new Date()
    });
  }

  public getConnectedUsers(): Map<string, AuthenticatedSocket> {
    return this.connectedUsers;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default ClaimSocket; 