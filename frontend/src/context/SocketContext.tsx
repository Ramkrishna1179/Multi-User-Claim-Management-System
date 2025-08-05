import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { socketLogger } from '../config/logger';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  lockClaim: (claimId: string) => Promise<boolean>;
  unlockClaim: (claimId: string) => void;
  joinClaim: (claimId: string) => void;
  leaveClaim: (claimId: string) => void;
  emitFormUpdate: (claimId: string, field: string, value: any) => void;
  onDataRefresh: (callback: () => void) => void;
  offDataRefresh: (callback: () => void) => void;
  manualRefresh: () => void;
  onAutoRefresh: (callback: () => void) => void;
  offAutoRefresh: (callback: () => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const dataRefreshCallbacksRef = useRef<Set<() => void>>(new Set());
  const autoRefreshCallbacksRef = useRef<Set<() => void>>(new Set());
  const connectionToastRef = useRef<string | null>(null);

  const triggerAutoRefresh = useCallback(() => {
    socketLogger.info('Triggering auto-refresh for all registered components');
    autoRefreshCallbacksRef.current.forEach(callback => {
      try {
        callback();
      } catch (error: any) {
        socketLogger.error('Error in auto-refresh callback:', { error: error.message });
      }
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated && token && !socketRef.current) {
      socketLogger.info('Initializing WebSocket connection', {
        socketUrl: process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000',
        userId: user?.id,
        userRole: user?.role,
        hasToken: !!token,
        tokenLength: token?.length
      });
      
      const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
        path: '/api/socket.io',
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socketLogger.info('Socket connected successfully', {
          socketId: socket.id,
          userId: user?.id,
          userRole: user?.role
        });
        
        setIsConnected(true);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.success('Connected to server', {
          duration: 5000,
          icon: '🟢'
        });
      });

      socket.on('disconnect', (reason) => {
        socketLogger.warn('Socket disconnected', {
          socketId: socket.id,
          reason,
          userId: user?.id
        });
        
        setIsConnected(false);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.error('🔴 Disconnected from server', {
          duration: 5000,
          icon: '🔴'
        });
      });

      socket.on('connect_error', (error) => {
        socketLogger.error('Socket connection error', {
          socketId: socket.id,
          error: error.message,
          userId: user?.id,
          socketUrl: process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'
        });
        
        setIsConnected(false);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.error(`🔴 Connection failed: ${error.message}`, {
          duration: 8000,
          icon: '🔴'
        });
      });

      socket.on('connect_timeout', () => {
        socketLogger.error('Socket connection timeout', {
          socketId: socket.id,
          userId: user?.id,
          socketUrl: process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000'
        });
        
        setIsConnected(false);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.error('🔴 Connection timeout. Server may be unavailable.', {
          duration: 8000,
          icon: '🔴'
        });
      });

      socket.on('reconnect', (attemptNumber) => {
        socketLogger.info('Socket reconnected', {
          socketId: socket.id,
          attemptNumber,
          userId: user?.id
        });
        
        setIsConnected(true);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.success('🟢 Reconnected to server', {
          duration: 3000,
          icon: '🟢'
        });
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        socketLogger.info('Socket reconnection attempt', {
          socketId: socket.id,
          attemptNumber,
          userId: user?.id
        });
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.loading(`🔄 Reconnecting... (Attempt ${attemptNumber})`, {
          duration: 3000
        });
      });

      socket.on('reconnect_error', (error) => {
        socketLogger.error('Socket reconnection error', {
          socketId: socket.id,
          error: error.message,
          userId: user?.id
        });
        
        setIsConnected(false);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
        }
        connectionToastRef.current = toast.error('🔴 Reconnection failed', {
          duration: 5000,
          icon: '🔴'
        });
      });

      // Business logic event handlers
      socket.on('claim_locked', (data) => {
        socketLogger.info('Claim locked event received', {
          claimId: data.claimId,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
          userId: user?.id
        });
        
        if (data.lockedBy !== user?.id) {
          toast(`Claim is being reviewed by ${data.lockedByName}`);
        }
        triggerAutoRefresh();
      });

      socket.on('claim_unlocked', (data) => {
        socketLogger.info('Claim unlocked event received', {
          claimId: data.claimId,
          unlockedBy: data.unlockedBy,
          unlockedByName: data.unlockedByName,
          userId: user?.id
        });
        
        if (data.unlockedBy !== user?.id) {
          toast(`Claim is now available for review`);
        }
        triggerAutoRefresh();
      });

      socket.on('lock_failed', (data) => {
        socketLogger.warn('Claim lock failed', {
          claimId: data.claimId,
          message: data.message,
          userId: user?.id
        });
        
        toast.error(data.message);
      });

      socket.on('claim_status_changed', (data) => {
        socketLogger.info('Claim status changed event received', {
          claimId: data.claimId,
          status: data.status,
          message: data.message,
          userId: user?.id
        });
        
        toast.success(data.message || `Claim status updated to ${data.status}`);
        triggerAutoRefresh();
      });

      socket.on('new_claim', (data) => {
        socketLogger.info('New claim event received', {
          claimId: data.claimId,
          userId: user?.id,
          userRole: user?.role
        });
        
        if (user?.role === 'account' || user?.role === 'admin') {
          toast.success('New claim submitted for review');
        }
        triggerAutoRefresh();
      });

      socket.on('deduction_applied', (data) => {
        socketLogger.info('Deduction applied event received', {
          claimId: data.claimId,
          userId: user?.id,
          targetUserId: data.userId
        });
        
        if (data.userId === user?.id) {
          toast('A deduction has been applied to your claim');
        }
        triggerAutoRefresh();
      });

      socket.on('deduction_response', (data) => {
        socketLogger.info('Deduction response event received', {
          claimId: data.claimId,
          action: data.action,
          message: data.message,
          userId: user?.id,
          userRole: user?.role
        });
        
        if (user?.role === 'account' || user?.role === 'admin') {
          const action = data.action === 'accepted' ? 'accepted' : 'rejected';
          toast.success(`User ${action} the deduction. ${data.message}`);
        }
        triggerAutoRefresh();
      });

      socket.on('form_field_updated', (data) => {
        socketLogger.debug('Form field updated event received', {
          claimId: data.claimId,
          field: data.field,
          updatedBy: data.updatedBy,
          updatedByName: data.updatedByName,
          userId: user?.id
        });
        
        if (data.updatedBy !== user?.id) {
          toast(`${data.updatedByName} is editing this claim`);
        }
      });

      socket.on('error', (data) => {
        socketLogger.error('Socket error event received', {
          error: data.message,
          userId: user?.id
        });
        
        toast.error(data.message || 'An error occurred');
      });

      socket.on('claim_updated', (data) => {
        socketLogger.info('Claim updated event received', {
          claimId: data.claimId,
          userId: user?.id
        });
        triggerAutoRefresh();
      });

      socket.on('claim_deleted', (data) => {
        socketLogger.info('Claim deleted event received', {
          claimId: data.claimId,
          userId: user?.id
        });
        triggerAutoRefresh();
      });

      socket.on('post_updated', (data) => {
        socketLogger.info('Post updated event received', {
          postId: data.postId,
          userId: user?.id
        });
        triggerAutoRefresh();
      });

      socket.on('user_updated', (data) => {
        socketLogger.info('User updated event received', {
          userId: user?.id,
          updatedUserId: data.userId
        });
        triggerAutoRefresh();
      });
    } else if (!isAuthenticated && socketRef.current) {
      // Clean up socket when user logs out
      socketLogger.info('User logged out, cleaning up socket connection');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    return () => {
      if (socketRef.current) {
        socketLogger.info('Cleaning up WebSocket connection', {
          socketId: socketRef.current.id,
          userId: user?.id
        });
        
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        
        if (connectionToastRef.current) {
          toast.dismiss(connectionToastRef.current);
          connectionToastRef.current = null;
        }
      }
    };
  }, [isAuthenticated, token, user, triggerAutoRefresh]);

  const lockClaim = useCallback(async (claimId: string): Promise<boolean> => {
    if (!socketRef.current || !isConnected) {
      socketLogger.warn('Attempted to lock claim without connection', {
        claimId,
        userId: user?.id,
        isConnected
      });
      toast.error('Not connected to server');
      return false;
    }

    socketLogger.info('Attempting to lock claim', {
      claimId,
      userId: user?.id
    });

    return new Promise((resolve) => {
      socketRef.current!.emit('lock_claim', { claimId });
      
      const timeout = setTimeout(() => {
        socketLogger.warn('Claim lock timeout', { claimId, userId: user?.id });
        resolve(false);
      }, 5000);

      const handleLockResponse = (data: any) => {
        if (data.claimId === claimId) {
          clearTimeout(timeout);
          socketRef.current!.off('claim_locked', handleLockResponse);
          socketRef.current!.off('lock_failed', handleLockFailed);
          
          socketLogger.info('Claim locked successfully', {
            claimId,
            userId: user?.id
          });
          
          resolve(true);
        }
      };

      const handleLockFailed = (data: any) => {
        if (data.claimId === claimId) {
          clearTimeout(timeout);
          socketRef.current!.off('claim_locked', handleLockResponse);
          socketRef.current!.off('lock_failed', handleLockFailed);
          
          socketLogger.warn('Claim lock failed', {
            claimId,
            userId: user?.id,
            message: data.message
          });
          
          resolve(false);
        }
      };

      socketRef.current!.on('claim_locked', handleLockResponse);
      socketRef.current!.on('lock_failed', handleLockFailed);
    });
  }, [isConnected, user]);

  const unlockClaim = useCallback((claimId: string) => {
    if (socketRef.current && isConnected) {
      socketLogger.info('Unlocking claim', {
        claimId,
        userId: user?.id
      });
      socketRef.current.emit('unlock_claim', { claimId });
    }
  }, [isConnected, user]);

  const joinClaim = useCallback((claimId: string) => {
    if (socketRef.current && isConnected) {
      socketLogger.info('Joining claim room', {
        claimId,
        userId: user?.id
      });
      socketRef.current.emit('join_claim', { claimId });
    }
  }, [isConnected, user]);

  const leaveClaim = useCallback((claimId: string) => {
    if (socketRef.current && isConnected) {
      socketLogger.info('Leaving claim room', {
        claimId,
        userId: user?.id
      });
      socketRef.current.emit('leave_claim', { claimId });
    }
  }, [isConnected, user]);

  const emitFormUpdate = useCallback((claimId: string, field: string, value: any) => {
    if (socketRef.current && isConnected) {
      socketLogger.debug('Emitting form update', {
        claimId,
        field,
        value,
        userId: user?.id
      });
      socketRef.current.emit('form_update', { claimId, field, value });
    }
  }, [isConnected, user]);

  const onDataRefresh = useCallback((callback: () => void) => {
    dataRefreshCallbacksRef.current.add(callback);
  }, []);

  const offDataRefresh = useCallback((callback: () => void) => {
    dataRefreshCallbacksRef.current.delete(callback);
  }, []);

  const onAutoRefresh = useCallback((callback: () => void) => {
    autoRefreshCallbacksRef.current.add(callback);
  }, []);

  const offAutoRefresh = useCallback((callback: () => void) => {
    autoRefreshCallbacksRef.current.delete(callback);
  }, []);

  const manualRefresh = useCallback(() => {
    socketLogger.info('Executing manual data refresh', { userId: user?.id });
    dataRefreshCallbacksRef.current.forEach(callback => callback());
  }, [user]);

  const value = useMemo<SocketContextType>(() => ({
    socket: socketRef.current,
    isConnected,
    lockClaim,
    unlockClaim,
    joinClaim,
    leaveClaim,
    emitFormUpdate,
    onDataRefresh,
    offDataRefresh,
    manualRefresh,
    onAutoRefresh,
    offAutoRefresh
  }), [isConnected, lockClaim, unlockClaim, joinClaim, leaveClaim, emitFormUpdate, onDataRefresh, offDataRefresh, manualRefresh, onAutoRefresh, offAutoRefresh]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}; 