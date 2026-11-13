/**
 * Turns any way of writing a Bangladesh mobile number into the one form the
 * Brain is asked with: +8801XXXXXXXXX.
 *
 *   "01712345678", "8801712345678", "+880 1712-345678", "1712345678"  ->  "+8801712345678"
 *
 * Kept free of imports so `npm test` (plain Node) can run it.
 */
export const toBrainPhone = (phone) => {
  const digits = String(phone ?? '')
    .replace(/\D/g, '')
    .replace(/^(00)?88(?=0|1\d{9}$)/, '') // the country code is already there: do not add it twice
    .replace(/^(?=1\d{9}$)/, '0'); // the first 0 was left out (typed that way, or lost in a spreadsheet)
  return digits ? `+88${digits}` : '';
};
