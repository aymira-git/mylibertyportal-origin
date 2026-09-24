// Shared UI entry points used across multiple domains.
export { default as AIAssistant } from "./AIAssistant";
export { default as ErrorBoundary } from "./ErrorBoundary";
export { default as DashboardShell } from "./DashboardShell";
export { default as MobileDashboardShell } from "./MobileDashboardShell";
export { default as Badge } from "./Badge";
export { default as StatCard } from "./StatCard";
export { default as Card } from "./Card";
export { default as ConfirmProvider } from "./ConfirmProvider";
export { default as ToastProvider } from "./ToastProvider";
export { useConfirm } from "./useConfirm";
export { useToast } from "./useToast";
export { default as LevelBadge } from "./LevelBadge";
export {
  LEVELS,
  LEVEL_KEYS,
  LEVEL_LIST,
  TIERS,
  TIER_KEYS,
  TIER_LIST,
  getTier,
  getStars,
  getStarText,
  getNextLevel,
  isCompatible,
} from "./levels";
export {
  PAYMENT_PLANS,
  PAYMENT_PLAN_KEYS,
  PAYMENT_PLAN_LIST,
  DEFAULT_BASE_MONTHLY_RATE,
  calculatePlanPricing,
  calculateExpiryDate,
  calculateCoveragePeriod,
  getPaymentHealthStatus,
  getPlanDetails,
} from "./paymentPlans";
export { uploadToCloudinary, uploadFileToCloudinary } from "./cloudinaryUpload";
export { exportTableCSV } from "./csvExport";
export { printTable } from "./printTable";
export { default as Pagination } from "./Pagination";
export { usePagination } from "./usePagination";
export { useNetworkStatus } from "./useNetworkStatus";
export { default as ConnectivityBanner } from "./ConnectivityBanner";
export { default as WelcomeBanner } from "./WelcomeBanner";
export { triggerHaptic } from "./mobileUtils";
export {
  APPROVAL_ROLES,
  APPROVAL_MODES,
  APPROVAL_STATUS,
  GATED_ACTIONS,
  createApprovalEnvelope,
  canApproveGate,
  isActionOperational,
} from "./approvalGates";
export { ApprovalInbox } from "./ApprovalInbox";
export {
  submitApprovalRequest,
  listenToPendingApprovals,
  approveApprovalRequest,
  rejectApprovalRequest,
} from "./approvalsRepository";

