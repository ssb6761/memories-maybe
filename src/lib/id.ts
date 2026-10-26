// crypto.randomUUID는 브라우저/Node 18+ 에서 기본 제공되므로 별도 uuid 패키지가 필요 없다.
export function createId(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function createShareId(): string {
  // 사람이 읽기 쉬운 8자리 공유코드 (대문자+숫자)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
