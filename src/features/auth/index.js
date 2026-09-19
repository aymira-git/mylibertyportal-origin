// Public entry points for authentication and account onboarding.
// RegistrationPage and StaffSignup are intentionally NOT exported here —
// App.jsx lazy-loads them by direct path, and re-exporting them through
// this barrel would pull them into the main bundle statically, defeating
// that code-splitting (this is the same reason dashboard/index.js doesn't
// export the role dashboards either).
export { default as LoginPage } from "./LoginPage";
export { default as ProfilePanel } from "./ProfilePanel";
