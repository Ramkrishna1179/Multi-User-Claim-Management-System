import { Router } from 'express';
import { saveFrontendLogs } from '../controllers/logs';

const router = Router();

// Route to receive and save frontend logs
router.post('/', saveFrontendLogs);

export default router; 