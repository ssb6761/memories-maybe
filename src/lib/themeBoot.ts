// 서버 레이아웃(layout.tsx)에서 쓰는 값이라 "use client" 파일(prefs.ts)과 분리해 둔다.
// 첫 화면이 그려지기 전에 실행하는 짧은 스크립트(깜빡임 방지). layout.tsx의 <head>에 넣는다.
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('mmpref:theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
