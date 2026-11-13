import apiClient from './apiClient';
import { toBrainPhone } from './phone';

/**
 * Asks the Brain if this order's customer may pay cash on delivery (COD).
 *
 * The "Check" button in the Orders table and the bulk check both come through
 * here, so they always ask the same question: the phone as +8801XXXXXXXXX and
 * the order's delivery area. It is the same request the shop's checkout page
 * sends for a customer (same phone form, no login token).
 *
 * Never rejects. Resolves to what the Orders table shows for the order:
 *   null                      the Brain allows COD        -> no badge
 *   { reason, ... }           the Brain blocks COD        -> red "BRAIN" badge
 *   { failed: true, reason }  the Brain could not answer  -> grey "BRAIN ?" badge
 *
 * A failure is its own answer on purpose: "could not ask" must never look like
 * "this customer is fine".
 */
export const checkCheckout = async (order) => {
  try {
    const phone = toBrainPhone(order.customer?.phone);
    if (!phone) throw new Error('this order has no phone number.');
    const answer = await apiClient('/api/brain/check-checkout', {
      method: 'POST',
      auth: false,
      body: { phone, delivery_area: order.delivery_area || order.customer?.area || '' },
    });
    return answer.cod_allowed ? null : answer;
  } catch (error) {
    return { failed: true, reason: `The Brain could not check this customer: ${error.message}` };
  }
};
