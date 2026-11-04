const timeFmt = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function formatMessageTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString() ? timeFmt.format(date) : dateTimeFmt.format(date);
}

export const formatDateTime = (date) => dateTimeFmt.format(date);

export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const initialOf = (name) => (name?.trim()?.[0] || "?").toUpperCase();

export const STATUS_LABELS = {
  PENDING: "Pendiente", QUEUED: "En cola", PROCESSING: "Enviando", RETRYING: "Reintentando",
  SENT: "Enviado", FAILED: "Falló", CANCELLED: "Anulado",
};
export const STATUS_COLORS = {
  PENDING: "blue", QUEUED: "purple", PROCESSING: "purple", RETRYING: "orange",
  SENT: "green", FAILED: "red", CANCELLED: "gray",
};
export const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "PROCESSING", "RETRYING"]);
export const CANCELLABLE_STATUSES = new Set(["PENDING", "RETRYING"]);
