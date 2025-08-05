import { Request, Response } from 'express';

interface AuthRequest extends Request {
  user?: any;
}

export const saveFrontendLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, message, data } = req.body;
    
    // Log the frontend message to console for now
    console.log(`[Frontend ${level.toUpperCase()}] ${message}`, data || '');
    
    res.status(200).json({ 
      success: true, 
      message: 'Log saved successfully' 
    });
  } catch (error) {
    console.error('Error saving frontend logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save log' 
    });
  }
}; 