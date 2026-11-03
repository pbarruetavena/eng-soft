import { Router } from 'express';
import {
  deleteSubscription,
  getSubscriptions,
  postSubscription,
  putSubscription,
  getSummary,
  getUpcomingCharges,
  dispararNotificacoes,
  toggleSubscriptionStatus,
} from '../controllers/subscriptionsController.js';
import { enviarLembrete } from '../services/mail/emailService.js';


const router = Router();

router.post('/', postSubscription);
router.get('/', getSubscriptions);
router.get('/summary', getSummary);
router.get('/upcoming-charges', getUpcomingCharges);
router.post('/notify-upcoming', dispararNotificacoes);
router.put('/:id', putSubscription);
router.patch('/:id/status', toggleSubscriptionStatus);
router.delete('/:id', deleteSubscription);
router.patch('/:id/cancel', deleteSubscription);

export default router;
