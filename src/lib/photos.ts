"use client";

// 사진을 올리기 전에 기기에서 줄인다(가로·세로 최대 1280px JPEG). 원본 그대로 올리면
// 한 장에 수 MB라 저장 공간과 데이터를 많이 쓰고 느리다.
export const MAX_PHOTOS = 10;
const MAX_SIDE = 1280;
const QUALITY = 0.78;

async function loadBitmap(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // 사진의 회전 정보(EXIF)를 반영해서 연다
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
      return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      // 일부 브라우저는 옵션이나 형식을 지원하지 않는다 → 아래 방법으로
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("사진을 열지 못했어요."));
      el.src = url;
    });
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function compressImage(file: File): Promise<string> {
  const { img, w, h, close } = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
}
