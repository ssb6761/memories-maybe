export const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: "₩",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  IDR: "Rp",
  THB: "฿",
  VND: "₫",
  CNY: "¥",
  GBP: "£",
  AUD: "A$",
  SGD: "S$",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOL[code?.toUpperCase()] ?? code ?? "";
}

// 통화별로 소수점 없이 자연스러운 자릿수 표기 (IDR/KRW/JPY/VND는 정수, 그 외는 정수로 통일해 트리플 스타일과 맞춘다)
export function formatAmount(amount: number, currency: string): string {
  const symbol = currencySymbol(currency);
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString("ko-KR");
  // Rp, A$ 처럼 여러 글자 기호는 앞에 공백 없이 붙인다 (트리플 표기 관례)
  return `${symbol}${formatted}`;
}

export function formatKRW(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

export function formatKRWApprox(amount: number): string {
  return `약 ₩${Math.round(amount).toLocaleString("ko-KR")}`;
}
