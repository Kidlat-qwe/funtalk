/**
 * Centralized human-readable labels for API enum / slug values (formal UI copy).
 */

export const EM_DASH = '—';

const norm = (v) => String(v ?? '').trim().toLowerCase();

/** Title-case each word in a snake_case or kebab-case string. */
export const titleCaseFromSnake = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const LOOKUP = (map, value, empty = EM_DASH) => {
  const v = norm(value);
  if (!v) return empty;
  if (map[v] != null) return map[v];
  return titleCaseFromSnake(value) || String(value);
};

// --- Class & booking ---

const CLASS_TYPE = {
  one_on_one: 'One-on-one',
  group: 'Group',
  vip: 'VIP',
};

export const formatClassTypeLabel = (classType) => LOOKUP(CLASS_TYPE, classType);

const MATERIAL_TYPE = {
  teacher_provided: 'Teacher Provided',
  student_provided: 'Student Provided',
  free_talk: 'Free Talk',
};

export const formatMaterialTypeLabel = (materialType) => LOOKUP(MATERIAL_TYPE, materialType);

const TEACHER_REQ = {
  picture: 'Picture',
  intro_video: 'Intro Video',
  curriculum_vitae: 'Curriculum Vitae',
  intro_audio: 'Intro Audio',
  intro_text: 'Intro Text',
};

export const formatTeacherRequirementLabel = (key) => LOOKUP(TEACHER_REQ, key, '');

// --- People & accounts ---

const GENDER = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

export const formatGenderLabel = (gender) => LOOKUP(GENDER, gender, 'N/A');

const USER_ROLE = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  school: 'School',
  teacher: 'Teacher',
};

export const formatUserRoleLabel = (userType) => LOOKUP(USER_ROLE, userType, 'N/A');

const ACCOUNT_STATUS = {
  active: 'Active',
  inactive: 'Inactive',
};

export const formatAccountStatusLabel = (status) => LOOKUP(ACCOUNT_STATUS, status, 'N/A');

const EMPLOYMENT = {
  part_time: 'Part-time',
  full_time: 'Full-time',
};

export const formatEmploymentTypeLabel = (type) => LOOKUP(EMPLOYMENT, type);

// --- Appointments ---

const APPOINTMENT_STATUS = {
  pending: 'Pending',
  approved: 'Approved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const formatAppointmentStatus = (status) => LOOKUP(APPOINTMENT_STATUS, status, 'Unknown');

// --- Billing & invoices ---

const INVOICE_STATUS = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const formatInvoiceStatus = (status) => LOOKUP(INVOICE_STATUS, status);

const BILLING_TYPE = {
  patty: 'Patty',
  explore: 'Explore',
};

export const formatBillingTypeLabel = (billingType) => {
  const v = norm(billingType);
  if (!v) return '—';
  if (BILLING_TYPE[v]) return BILLING_TYPE[v];
  return titleCaseFromSnake(billingType);
};

const PAYMENT_METHOD = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  e_wallet: 'E-wallet',
  cash: 'Cash',
  other: 'Other',
};

export const formatPaymentMethodLabel = (method) => {
  const v = norm(method);
  if (!v) return '—';
  if (PAYMENT_METHOD[v]) return PAYMENT_METHOD[v];
  return titleCaseFromSnake(method);
};

// --- Credits ---

const CREDIT_TX = {
  purchase: 'Purchase',
  deduction: 'Deduction',
  refund: 'Refund',
  adjustment: 'Adjustment',
  expired: 'Expired',
};

export const formatCreditTransactionType = (type) => LOOKUP(CREDIT_TX, type);

const SETTLEMENT_TYPE = {
  full_payment_paid: 'Full Payment',
  installment_fully_paid: 'Installment Completed',
};

export const formatSettlementTypeLabel = (type) => LOOKUP(SETTLEMENT_TYPE, type);
