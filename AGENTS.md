# AGENTS.md

## Operational Commands

```bash
# 모든 명령은 Bun 사용 (npm, yarn, pnpm 금지)
bun install                  # 의존성 설치
bun run dev                  # API 서버 + Vite 프론트엔드 동시 실행 (포트 3002 + 5173)
bun run server               # API 서버만 실행 (포트 3002)
bun run build                # TypeScript + Vite 빌드
bun test                     # Vitest 단위 테스트 (watch 제외)
bun test:watch              # Vitest watch 모드
bun lint                     # ESLint 검사
```

**프론트엔드 브라우저**: `http://localhost:5173` (Vite 기본 포트)

## Golden Rules

### 1. 멀티 프로바이더 비대칭 처리
**Do**: Google 모델은 폴백 체인 실행, Anthropic은 단일 모델 사용.

**Why**: Google API가 불안정하거나 quota 초과시 자동 재시도가 필요한 설계. Anthropic은 안정성이 높아 단일 모델만 충분.

**How to apply**: 
- API 호출 추가 시 프로바이더별로 다른 폴백 정책 유지 (server/index.ts:134-136 참고)
- Anthropic 추가 모델 시도 금지

**Reference**: `server/index.ts:5`, `server/index.ts:134-136`

---

### 2. react-live render() 호출 강제 주입
**Do**: 생성된 컴포넌트 코드 마지막에 명시적 `render(<ComponentName />)` 호출 필수.

**Don't**: render 호출 없이 컴포넌트 선언만 반환하기.

**Why**: react-live의 `noInline={true}` 모드에서는 render 함수 호출 없으면 UI가 화면에 나타나지 않음 (하드 제약).

**How to apply**:
- 모든 AI 응답은 `ensureRenderCall()` 함수로 처리 (server/generator.ts:16-24)
- 테스트로 항상 검증 (server/generator.test.ts:26-39)
- 예시: `const Button = () => <button>Click</button>; render(<Button />);`

**Reference**: `src/components/LivePreview.tsx:14`, `server/generator.ts:12-24`, `server/generator.test.ts:20-40`

---

### 3. API 키 보안 경계
**Do**: 
- 서버에서만 `process.env.ANTHROPIC_API_KEY`, `process.env.GOOGLE_API_KEY` 접근
- 클라이언트가 입력한 API 키는 프록시로만 사용 (AI API에 전달만 함)
- `/api/config` 응답에 boolean 플래그만 전송 (키 값 노출 금지)

**Don't**:
- 클라이언트 코드에서 환경변수 직접 접근 (Vite 없는 설정)
- API 응답에 API 키, 모델명, 내부 상태 정보 포함
- 서버 에러 메시지에 API 키 내용 노출

**Why**: 클라이언트 코드는 브라우저 콘솔에 노출되므로, API 키는 서버에서만 관리.

**How to apply**:
- 프론트엔드는 `/api/config` → boolean 만 읽기
- 프론트엔드는 `/api/generate` → code, error 만 받기
- 백엔드는 요청의 apiKey 필드만 사용, 응답에 절대 포함 금지

**Reference**: `server/index.ts:60-62`, `server/index.ts:147-156`, `src/App.tsx:25-28`

---

### 4. 코드 정규화: 이중 처리
**Do**: AI 응답에 두 단계 정규화 적용:
1. `stripCodeFences()` → 마크다운 펜스 제거
2. `ensureRenderCall()` → render 호출 주입

**Why**: AI 응답이 불규칙하게 방출되므로 (펜스 有/無, render 呼び出し有/無), 이중 필터로 안정성 확보.

**How to apply**:
- `server/generator.ts` 함수는 순수 함수로 유지 (부수효과 없음)
- 테스트가 전체 경로를 커버하는지 확인
- 새 정규화 로직 추가 시 `server/generator.test.ts`에 테스트 케이스 필수

**Reference**: `server/index.ts:188`, `server/generator.ts`, `server/generator.test.ts`

---

### 5. 테스트 필수 구간
**Do**: 다음 파일은 단위 테스트 필수:
- `server/generator.ts` (순수 함수, 정규화 로직)
- `server/fallback.ts` (폴백 체인 로직)
- 새로운 `server/` 내 순수 함수

**Don't**: 테스트 없이 다음 파일 수정하기:
- `server/index.ts` (API 핸들러) — 통합 테스트만 가능하므로, 로직은 순수 함수로 추출해 테스트
- `src/components/` — 기존에 테스트 없는 파일이므로, 추가 시 테스트 함께 작성

**Why**: 서버의 핵심 로직 (코드 생성, 모델 폴백)은 재현 불가능한 AI API에 의존하므로, 순수 함수는 반드시 테스트로 보호.

**How to apply**:
- 테스트 실행: `bun test` 또는 `bun test:watch`
- 신규 API 엔드포인트 추가 시 요청/응답 검증 로직은 순수 함수로 분리하고 테스트

**Reference**: `server/generator.test.ts`, `server/fallback.test.ts`, `src/components/PromptInput.test.tsx`

---

## Project Context

**목표**: 프롬프트 입력 → AI가 즉시 React 컴포넌트 생성 → 실시간 미리보기 + 코드 제공

**Tech Stack**:
- Runtime: Bun (서버), Node.js/브라우저 (프론트엔드)
- 빌드: TypeScript, Vite
- 테스트: Vitest, @testing-library
- 런타임 렌더링: react-live (noInline 모드)
- AI: Anthropic Claude, Google Gemini (선택 가능)

**핵심 흐름**:
```
사용자 프롬프트
  ↓
/api/generate (POST)
  ↓
Anthropic 또는 Google API 호출
  ↓
stripCodeFences() + ensureRenderCall()
  ↓
react-live에서 실시간 렌더링
```

## Context Map (Action-Based Routing)

- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — AI API 호출, 모델 폴백, 코드 정규화, CORS 설정 변경 시
- **[React 프론트엔드 (react-live)](./src/AGENTS.md)** — UI 컴포넌트, 프로바이더 선택, API 키 입력, 미리보기/코드 탭 작업 시

## Standards & References

**Git Commit**:
- Format: `type: 한국어 제목` (feat, fix, refactor, chore, test)
- Example: `feat: API 키 UI 추가`, `fix: render 호출 누락 버그`

**코딩 규칙**:
- ESLint: `bun lint` 통과 필수
- TypeScript: `tsc -b` 통과 필수
- React: 함수형 컴포넌트만 사용, react-live 호환성 유지

**Maintenance Policy**:
규칙과 코드의 괴리가 생기면 AGENTS.md 업데이트를 제안하세요. 금지 사항과 근거 파일이 일치하지 않으면 즉시 수정합니다.

