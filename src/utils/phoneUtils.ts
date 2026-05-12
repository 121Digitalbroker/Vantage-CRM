/**
 * Obfuscates a phone number string to prevent browser extensions from
 * automatically detecting and intercepting it as a clickable link.
 * It inserts a zero-width space (\u200B) which is invisible to the user
 * but breaks the regular expression patterns used by extensions.
 */
export function obfuscatePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  // Insert a zero-width space after the 3rd and 6th characters
  if (phone.length > 3) {
    return phone.slice(0, 3) + '\u200B' + phone.slice(3, 6) + '\u200B' + phone.slice(6);
  }
  return phone;
}

/**
 * Triggers a phone call using a hidden iframe.
 * This technique often bypasses browser extensions that intercept
 * standard window.location.href = 'tel:...' assignments.
 */
export function triggerCall(phone: string | null | undefined): void {
  if (!phone) return;
  
  // Clean the phone number (remove spaces, etc. but keep +)
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'display:none;');
  iframe.setAttribute('src', `tel:${cleanPhone}`);
  document.body.appendChild(iframe);
  
  // Clean up after a short delay
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 300);
}
