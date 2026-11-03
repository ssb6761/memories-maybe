// 팝업·화면을 닫는 ✕ 아이콘. 손가락으로 누르기 쉽게 크게(그림 22px, 누르는 영역은 버튼 쪽에서 40px).
export default function CloseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
