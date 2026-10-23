import { Router } from 'express';
import { isDatabaseConnected } from '../config/database.js';
import { getIO } from '../socket/index.js';

const router = Router();

router.get('/', (req, res) => {
  const dbStatus = isDatabaseConnected() ? 'connected' : 'disconnected';
  const socketStatus = getIO() ? 'initialized' : 'inactive';

  return res.success(
    {
      status: 'healthy',
      service: 'aidflow-server',
      version: '0.1.0',
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus,
      socketIO: socketStatus
    },
    'AidFlow API Foundation is operational'
  );
});

export default router;
