# 온라인 공유 백엔드 배포 가이드 (Cloudflare Workers + D1)

이 폴더(`worker/`)는 여행 데이터를 **서버(Cloudflare D1 데이터베이스)에 저장**해서, 링크(공유
코드)를 아는 사람이라면 누구든 같은 데이터를 보고 실제로 함께 편집할 수 있게 해주는 백엔드
API입니다. 로그인 없이 "공유 코드"만으로 접근하는 프로토타입 수준의 인증이며, 실시간 동기화는
초 단위 폴링(4초 간격) 방식입니다 — 완전한 실시간(WebSocket)은 아니지만 여러 명이 거의 동시에
보고 고쳐도 몇 초 안에 서로 화면에 반영됩니다.

Next.js 앱(이 저장소의 나머지 부분)은 이 Worker가 배포되어 있지 않아도 정상적으로 동작합니다
(그 경우 지금까지처럼 내 브라우저에만 저장되는 로컬 모드로 동작). 아래 과정은 **"다른 사람과
진짜로 같은 데이터를 공유하고 싶을 때만"** 필요합니다.

## ⚠️ 이미 `gabojago-api`로 배포해서 쓰고 계신 경우 (이름을 `추억일지도`로 바꾸고 싶을 때)

Cloudflare Worker는 `wrangler.toml`의 `name` 값이 곧 그 서버의 정체성이라, 이름을 바꾸고
`npm run deploy`를 하면 기존 걸 "고쳐주는" 게 아니라 **완전히 새로운 서버를 그 이름으로
새로 만듭니다.** 그래서 이름을 바꾸려면 아래 순서대로 해주셔야 안전합니다.

1. 이번 업데이트로 받은 `worker/wrangler.toml`의 `name`과 `database_name`은 이미
   `memories-maybe-api` / `memories-maybe-db`로 바뀌어 있어요. **단, `database_id` 줄은
   덮어쓰지 말고 지금 실제로 쓰고 계신 값(기존 `gabojago-db`에 연결된 값)을 그대로
   유지하세요** (같은 데이터베이스를 그대로 계속 쓰는 것뿐이라 데이터는 안전합니다 —
   database_id만 같으면 이름이 달라도 같은 데이터베이스를 가리켜요).
2. `worker` 폴더에서 `npm run deploy` 실행 → `memories-maybe-api`라는 **새 이름의 Worker가
   새로 배포**되고, 새 주소(`https://memories-maybe-api.<계정>.workers.dev`)가 출력됩니다.
3. 그 새 주소를 복사해서, Vercel 프로젝트의 환경변수 `NEXT_PUBLIC_API_BASE_URL` 값을
   새 주소로 바꿔주세요 (로컬에서 테스트 중이면 `.env.local`도 같이).
4. Vercel에서 한 번 재배포(새로 git push 하거나 Vercel 대시보드에서 "Redeploy")해야 바뀐
   환경변수가 실제로 적용됩니다.
5. 새 주소로 온라인 여행이 잘 보이는지 확인한 뒤, 예전 `gabojago-api` Worker는
   Cloudflare 대시보드(Workers & Pages → Overview → `gabojago-api` 선택 → Delete)에서
   지우시면 돼요. 안 지워도 동작에는 문제없지만, 안 쓰는 서버가 남아있는 것뿐이라 정리
   차원에서 지우는 걸 권장드려요. (그 전 이름이었던 `triple-planner-api`가 아직 남아있다면
   그것도 같이 정리하셔도 좋아요.)

D1 데이터베이스 자체는 `database_id`로 식별되기 때문에, Cloudflare 쪽에 실제로 등록된
이름까지 "gabojago-db → memories-maybe-db"로 바꾸고 싶으시면 Cloudflare 대시보드
(Workers & Pages → D1 → 해당 데이터베이스)에 이름 변경 메뉴가 있는지 확인해보세요. 이건
순전히 보여지는 이름일 뿐이라 안 바꿔도 전혀 문제되지 않습니다.

## 준비물

- Cloudflare 계정 (이미 가입하셨다고 하셨으니 이 단계는 생략)
- Node.js 18 이상이 설치된 내 컴퓨터 (Next.js 앱을 실행하는 것과 같은 컴퓨터면 됩니다)

## 1. Wrangler 설치 확인 및 로그인

`wrangler`는 Cloudflare가 만든 배포 도구입니다. `worker/package.json`에 devDependency로
이미 들어있으므로 별도 전역 설치 없이 아래처럼 진행하면 됩니다.

```bash
cd memories-maybe/worker
npm install
npx wrangler login
```

`wrangler login`을 실행하면 브라우저가 열리고 Cloudflare 계정으로 로그인 후 권한을
허용하라는 화면이 나옵니다. 허용하면 터미널로 돌아와서 "Successfully logged in" 같은
메시지가 뜹니다.

## 2. D1 데이터베이스 생성

```bash
npx wrangler d1 create memories-maybe-db
```

실행하면 아래와 비슷한 출력이 나옵니다 (database_id는 실제로는 다른 값입니다):

```
[[d1_databases]]
binding = "DB"
database_name = "memories-maybe-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

이 중 **`database_id` 값을 복사**해서 `worker/wrangler.toml` 파일을 열고
`REPLACE_WITH_YOUR_D1_DATABASE_ID` 부분을 그 값으로 바꿔주세요.

```toml
[[d1_databases]]
binding = "DB"
database_name = "memories-maybe-db"
database_id = "여기에_복사한_실제_id_붙여넣기"
```

## 3. 데이터베이스 테이블 생성 (스키마 적용)

로컬 테스트용과 실제 배포용 두 가지가 있는데, 실제로 온라인 공유를 하려면 `--remote`
쪽을 실행해야 합니다.

```bash
# 실제 Cloudflare 서버의 D1에 테이블 생성 (필수)
npm run db:migrate:remote

# (선택) 내 컴퓨터에서 wrangler dev로 로컬 테스트할 때 쓰는 로컬 D1
npm run db:migrate:local
```

`worker/schema.sql`에 정의된 `trips`, `travelers`, `schedule_items`, `expenses` 4개
테이블이 생성됩니다. 한 번만 실행하면 되고, 이미 존재하는 상태에서 다시 실행해도 에러 없이
넘어갑니다 (`CREATE TABLE IF NOT EXISTS`).

> ⚠️ **이미 예전에 이 과정을 한 번 진행해서 데이터가 들어있는 경우** (즉, 지금 새로
> 처음 만드는 게 아니라 "메모 추가" 기능이 추가되기 전에 이미 배포해두셨던 경우)만
> 아래 1회성 마이그레이션을 추가로 실행해주세요. 이미 실행하신 적이 있다면("duplicate
> column" 에러가 뜨면) 이미 적용되어 있다는 뜻이니 그냥 넘어가시면 됩니다.
>
> ```bash
> npx wrangler d1 execute memories-maybe-db --remote --file=./migrate_002_add_kind.sql
> ```

## 4. Worker 배포

```bash
npm run deploy
```

성공하면 아래처럼 실제 접속 가능한 URL이 출력됩니다:

```
Published memories-maybe-api
  https://memories-maybe-api.<내-계정-서브도메인>.workers.dev
```

이 URL을 복사해두세요. 이게 바로 백엔드 API 주소입니다.

(로컬에서 먼저 테스트해보고 싶다면 배포 전에 `npm run dev`로 `http://localhost:8787`에서
Worker를 띄워볼 수 있습니다. 이 경우 3단계에서 `db:migrate:local`도 실행해두어야 합니다.)

## 5. Next.js 앱에 백엔드 주소 연결

`memories-maybe` 폴더(worker 폴더의 상위 폴더)로 돌아가서 `.env.local` 파일을
만들거나 엽니다.

```bash
cd ..
cp .env.example .env.local   # 아직 없다면
```

`.env.local`에 아래 줄을 추가합니다 (4단계에서 복사한 실제 주소로):

```
NEXT_PUBLIC_API_BASE_URL=https://memories-maybe-api.<내-계정-서브도메인>.workers.dev
```

그리고 Next.js 개발 서버를 재시작합니다 (환경 변수는 서버를 껐다 켜야 반영됩니다):

```bash
npm run dev
```

## 6. 확인

브라우저에서 `/trips` 페이지를 열면 이제 **"🌐 온라인으로 공유하기"** 카드에 "온라인 여행
만들기" 버튼과 "공유 코드로 참여하기" 입력창이 나타납니다. 온라인 여행을 하나 만들면
`/remote/공유코드/schedule` 같은 주소로 이동하는데, 이 주소(정확히는 공유 코드)를 다른
사람에게 알려주면 그 사람도 같은 데이터를 보고 편집할 수 있습니다. 서로 다른 브라우저/기기
에서 열어서 한쪽에서 일정을 추가하고 다른 쪽에서 (최대 4초 후) 새로고침 없이 반영되는지
확인해보세요.

이 앱을 Vercel 등에 배포해서 인터넷에 공개하면, 그 배포 주소 + 이 Worker 주소 조합으로
누구나(다른 기기에서도) 실제 온라인 공유가 가능해집니다. Vercel 배포 시에도
`NEXT_PUBLIC_API_BASE_URL` 환경변수를 Vercel 프로젝트 설정에 동일하게 등록해주세요.

> 📌 **git push와 Worker 배포는 별개입니다.** Git 저장소를 Vercel에 연결해두면
> `git push`할 때마다 Next.js 프론트엔드는 자동으로 재배포되지만, 이 `worker/` 폴더의
> 코드(`worker/src/*.ts`, `worker/schema.sql` 등)가 바뀐 경우엔 Vercel이 아니라
> **여기 `worker` 폴더에서 `npm run deploy`를 직접 실행해야** 실제 Cloudflare 서버에
> 반영됩니다. 즉 "프론트엔드만 바꿨을 때"는 git push만으로 충분하지만, "온라인 공유
> 기능(백엔드) 자체를 바꿨을 때"는 git push + `worker` 폴더에서 `npm run deploy`를
> 둘 다 해줘야 합니다.

## 참고 — 이 백엔드가 하는 일 / 하지 않는 일

**하는 일**
- 여행 정보, 동행자, 일정, 지출을 Cloudflare D1(서버 DB)에 저장
- 4초 폴링으로 다른 사람의 변경사항을 감지해 자동 반영 (탭이 백그라운드일 땐 폴링 정지)
- CSV 가져오기를 서버에서 처리 (여러 명이 동시에 가져와도 서버 쪽에서 중복 방지)
- CORS 허용 (어느 도메인에 배포된 프론트엔드에서든 호출 가능)

**하지 않는 일 (프로토타입 한계)**
- 로그인/계정 시스템 없음 — 공유 코드(shareId)를 아는 사람은 누구나 조회·수정 가능
- 완전한 실시간(WebSocket/Durable Objects)이 아닌 폴링 방식이라 최대 몇 초의 지연이 있음
- 동시 수정 충돌 처리(예: 두 사람이 같은 항목을 동시에 수정)는 "마지막 저장이 승리"하는
  단순한 방식이며, 별도의 충돌 감지·병합 로직은 없음

## 문제 해결

- `wrangler d1 create` 실행 시 이미 같은 이름의 DB가 있다는 오류 → Cloudflare 대시보드
  (Workers & Pages → D1)에서 기존 DB의 database_id를 확인해 `wrangler.toml`에 넣거나,
  다른 이름으로 새로 만드세요.
- 배포는 됐는데 앱에서 "온라인 공유 서버가 연결되어 있지 않다"는 안내가 계속 보임 →
  `.env.local`의 변수 이름이 정확히 `NEXT_PUBLIC_API_BASE_URL`인지, 앱을 재시작했는지
  확인하세요. `NEXT_PUBLIC_` 접두사가 없으면 브라우저에서 읽을 수 없습니다.
- 온라인 여행 생성 시 "Failed to fetch" 류의 오류 → Worker 주소가 정확한지(마지막에
  슬래시`/`가 붙지 않았는지), CORS가 차단되진 않는지 브라우저 개발자도구의 Network 탭을
  확인하세요.

## 항공편 추가 기능 업데이트 (migrate_003)

일정에 "항공편" 항목이 생기면서 `schedule_items` 테이블에 `flight_json` 칸이 추가됐습니다.
이미 배포해서 쓰고 있는 경우 worker 폴더에서 아래 두 명령을 **순서대로** 한 번씩 실행하세요.

```bash
npx wrangler d1 execute memories-maybe-db --remote --file=./migrate_003_add_flight.sql
npx wrangler deploy
```

마이그레이션 없이 Worker만 배포하면 일정 저장이 실패하니 꼭 마이그레이션을 먼저 실행하세요.

## 결제수단 기능 업데이트 — 이제 마이그레이션 명령이 필요 없어요

이번 버전부터 Worker가 처음 요청을 받을 때 데이터베이스에 빠진 칸(컬럼)이 있으면
스스로 추가합니다(`src/index.ts`의 `ensureSchema`). 그래서 새 칸이 생기는 업데이트도
worker 폴더에서 아래 한 줄만 실행하면 됩니다.

```bash
npx wrangler deploy
```

(이전에 안내한 `migrate_00X_*.sql` 파일은 이미 실행했어도, 안 했어도 괜찮아요.)

## 로그인(카카오 · 네이버 · 구글) 설정

이번 버전부터 **로그인해야만 앱을 쓸 수 있고, 여행은 초대받은 멤버만** 볼 수 있습니다.
각 회사에서 키를 받아 Worker에 등록해야 로그인 버튼이 동작해요.

먼저 내 Worker 주소를 확인하세요. `npx wrangler deploy`를 실행하면 마지막에
`https://memories-maybe-api.<내계정>.workers.dev` 같은 주소가 나옵니다(아래에서 `<WORKER>`).
앱 주소는 Vercel 주소입니다(아래에서 `<APP>`, 예: `https://memories-maybe.vercel.app`).

### 1. 카카오 (https://developers.kakao.com)
1. 내 애플리케이션 → 애플리케이션 추가하기
2. 앱 설정 → 앱 키에서 **REST API 키** 복사 → `KAKAO_CLIENT_ID`
3. 카카오 로그인 → **활성화 ON**, Redirect URI에 `<WORKER>/auth/kakao/callback` 등록
4. 카카오 로그인 → 동의항목에서 **닉네임**, **프로필 사진** 설정
5. (선택) 보안 → Client Secret을 켰다면 그 값 → `KAKAO_CLIENT_SECRET`
6. 플랫폼 → Web 사이트 도메인에 `<APP>` 등록

### 2. 네이버 (https://developers.naver.com)
1. Application → 애플리케이션 등록, 사용 API: **네이버 로그인**
2. 제공 정보: **별명**, **프로필 사진** (이메일은 선택)
3. 서비스 환경: PC 웹 / 모바일 웹 — 서비스 URL `<APP>`, Callback URL `<WORKER>/auth/naver/callback`
4. **Client ID** → `NAVER_CLIENT_ID`, **Client Secret** → `NAVER_CLIENT_SECRET`
5. ⚠️ "개발 중" 상태에서는 멤버관리 탭에 등록한 아이디만 로그인됩니다.
   친구들도 쓰게 하려면 테스트 아이디로 추가하거나 **검수 요청**을 해야 해요.

### 3. 구글 (https://console.cloud.google.com — 지도 키를 받은 그 프로젝트)
1. API 및 서비스 → OAuth 동의 화면: 외부, 앱 이름 "추억일지도", 범위는 기본(email, profile, openid)
2. 사용자 인증 정보 → 사용자 인증 정보 만들기 → **OAuth 클라이언트 ID** → 웹 애플리케이션
3. 승인된 리디렉션 URI: `<WORKER>/auth/google/callback`
4. 클라이언트 ID → `GOOGLE_CLIENT_ID`, 클라이언트 보안 비밀번호 → `GOOGLE_CLIENT_SECRET`
5. ⚠️ 동의 화면이 "테스트" 상태면 테스트 사용자로 등록한 계정만 로그인됩니다.
   다른 사람도 쓰게 하려면 **앱 게시(프로덕션으로 푸시)** 를 눌러주세요(기본 범위만 쓰면 별도 심사 없음).

### 4. Worker에 키 등록 + 배포 (worker 폴더에서)
`wrangler.toml`의 `ALLOWED_ORIGINS`에 내 앱 주소가 맞게 들어있는지 먼저 확인하세요.

```bash
# 세션 서명용 비밀 문자열 — 아래로 하나 만들어서 붙여넣기
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npx wrangler secret put SESSION_SECRET

npx wrangler secret put KAKAO_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# (카카오 Client Secret을 켠 경우에만) npx wrangler secret put KAKAO_CLIENT_SECRET

npx wrangler deploy
```

`secret put`을 실행하면 값을 입력하라고 나오는데, 복사한 값을 붙여넣고 엔터를 누르면 됩니다.
**Worker를 배포한 뒤에는 바로 앱도 푸시해주세요.** 새 Worker는 로그인 없는 요청을 막기 때문에
예전 앱으로는 여행이 안 열립니다.

### 예전 여행은?
로그인 전에 쓰던 여행은 그 기기에서 처음 로그인할 때 자동으로 계정에 옮겨집니다.
멤버가 없던 예전 여행은 처음 참여한 사람이 방장이 돼요. 친구는 여행 관리 → 초대 링크로 참여합니다.
