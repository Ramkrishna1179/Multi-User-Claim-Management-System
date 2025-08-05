import React, { createContext, useContext, useReducer, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { userActionLogger } from '../config/logger';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'account' | 'admin';
  profileImageUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        loading: false,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authAPI.getProfile();
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: response.data.user, token },
          });
        } catch (error) {
          localStorage.removeItem('token');
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        dispatch({ type: 'CLEAR_ERROR' });
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (state.token) {
      localStorage.setItem('token', state.token);
    } else {
      localStorage.removeItem('token');
    }
  }, [state.token]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    userActionLogger.info('User login attempt', { email });
    
    try {
       const response = await authAPI.login(email, password);
      const { user, token } = response.data;
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token },
      });
      
      userActionLogger.info('User login successful', { 
        userId: user.id, 
        userRole: user.role, 
        userName: user.name 
      });
      
      toast.success('Login successful!');
      
      if (user.role === 'admin') {
        navigate('/reports');
      } else if (user.role === 'account') {
        navigate('/review-claims');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      userActionLogger.error('User login failed', { 
        email, 
        error: message 
      });
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      toast.error(message);
    }
  }, [navigate]);

  const register = useCallback(async (name: string, email: string, password: string, role: string = 'user') => {
    dispatch({ type: 'LOGIN_START' });
    userActionLogger.info('User registration attempt', { email, role });
    
    try {
      const response = await authAPI.register(name, email, password, role);
      const { user, token } = response.data;
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token },
      });
      
      userActionLogger.info('User registration successful', { 
        userId: user.id, 
        userRole: user.role, 
        userName: user.name 
      });
      
      toast.success('Registration successful!');
      navigate('/');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      toast.error(message);
    }
  }, [navigate]);

  const logout = useCallback(() => {
    userActionLogger.info('User logout', { 
      userId: state.user?.id, 
      userRole: state.user?.role, 
      userName: state.user?.name 
    });
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
    navigate('/login');
  }, [navigate, state.user]);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    userActionLogger.info('User profile update attempt', { 
      userId: state.user?.id, 
      updatedFields: Object.keys(data) 
    });
    
    try {
      const response = await authAPI.updateProfile(data);
      dispatch({ type: 'UPDATE_USER', payload: response.data.user });
      
      userActionLogger.info('User profile updated successfully', { 
        userId: state.user?.id, 
        updatedFields: Object.keys(data) 
      });
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      userActionLogger.error('User profile update failed', { 
        userId: state.user?.id, 
        error: message 
      });
      toast.error(message);
    }
  }, [state.user]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    login,
    register,
    logout,
    updateProfile,
    clearError,
  }), [state, login, register, logout, updateProfile, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 