export const REFERRAL_LOCALSTORAGE_KEY = "memecooking_referral";
export const REFERRAL_EXPIRY_KEY = "memecooking_referral_expiry";
export const REFERRAL_EXPIRY_TIME = 2 * 7 * 24 * 60 * 60 * 1000; // 2 weeks

export function getReferral() {
  const referral = localStorage.getItem(REFERRAL_LOCALSTORAGE_KEY);
  const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);

  if (referral && expiry) {
    const now = Date.now();
    if (now < parseInt(expiry)) {
      return referral;
    } else {
      localStorage.removeItem(REFERRAL_LOCALSTORAGE_KEY);
      localStorage.removeItem(REFERRAL_EXPIRY_KEY);
    }
  }
  return null;
}

export function readAndSetReferral() {
  // read from url
  const url = new URL(window.location.href);
  const referral = url.searchParams.get("referral");
  if (referral) {
    const now = Date.now();
    const expiry = now + REFERRAL_EXPIRY_TIME;
    localStorage.setItem(REFERRAL_LOCALSTORAGE_KEY, referral);
    localStorage.setItem(REFERRAL_EXPIRY_KEY, expiry.toString());
    // Remove the referral search parameter from the URL
    url.searchParams.delete("referral");
    window.history.replaceState({}, document.title, url.toString());
  }
}
