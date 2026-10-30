/** A wa.me link. WhatsApp wants the country code, and students usually type a 10-digit Indian number. */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}
