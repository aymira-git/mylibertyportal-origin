/**
 * Centralized external URLs and fallback endpoints for MYLIBERTY portal.
 */

export const STUDENT_APPLICATIONS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/12FfhjJ_gxXLhII8LYLhOyeIbwcxXLNIlvZ2RbtdVgqQ/edit?resourcekey=&gid=800855144#gid=800855144";

export const REGISTRATION_GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScYE1ZzBSa-qd4k_PVvFhZFyr8WIFzg3KCZlGrtAsaJXLe-dg/viewform?embedded=true";

export const REGISTRATION_FALLBACK_URL = "https://myliberty.id/register";

export function getRegistrationUrl() {
  return typeof window !== "undefined"
    ? `${window.location.origin}/register`
    : REGISTRATION_FALLBACK_URL;
}
