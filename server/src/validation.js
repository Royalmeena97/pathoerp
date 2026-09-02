// Small, dependency-free input checks shared across routes.

export function isValidPhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length === 10;
}

export function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 80;
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 4 && password.length <= 72;
}

export function isValidPrice(price) {
  const n = Number(price);
  return Number.isInteger(n) && n >= 0 && n <= 1000000;
}

export function isValidPercent(percent) {
  const n = Number(percent);
  return Number.isInteger(n) && n >= 0 && n <= 100;
}
