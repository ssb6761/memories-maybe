"use client";

import { useRef, type ChangeEvent, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

// 오른쪽 끝에 ✕(지우기) 버튼이 붙은 입력칸. 글자가 있을 때만 ✕가 보인다.
// 일반 <input> 자리에 그대로 바꿔 끼울 수 있게 props는 똑같이 받는다. ✕를 누르면
// 원래 onChange에 빈 값("")이 들어간 것처럼 알려준다.
export default function ClearableInput({ className = "", value, onChange, disabled, readOnly, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value !== undefined && value !== null && String(value) !== "";
  // 가로로 나란히 놓인 칸(flex-1)은 바깥 상자가 그 자리를 차지해야 레이아웃이 안 깨진다.
  const wrapperClass = /\bflex-1\b/.test(className) ? "relative min-w-0 flex-1" : "relative w-full";

  function clear() {
    onChange?.({ target: { value: "" }, currentTarget: { value: "" } } as unknown as ChangeEvent<HTMLInputElement>);
    inputRef.current?.focus();
  }

  return (
    <div className={wrapperClass}>
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
        className={`${className.replace(/\bflex-1\b/, "")} w-full ${hasValue ? "pr-9" : ""}`}
      />
      {hasValue && !disabled && !readOnly && (
        <button
          type="button"
          // 누르는 순간 입력칸 포커스가 빠지지 않게(키보드가 내려가지 않게) 막는다.
          onMouseDown={(e) => e.preventDefault()}
          onClick={clear}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-ink-300 text-[10px] font-bold text-white"
          aria-label="입력 내용 지우기"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
    </div>
  );
}
