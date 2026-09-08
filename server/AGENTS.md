# server/AGENTS.md

AI API 프록시 서버 및 코드 정규화 로직. Bun 런타임에서 Anthropic / Google 모델을 호출하고, 응답을 react-live 호환 코드로 변환합니다.

## Module Context

`server/`는 세 가지 역할을 수행합니다:

1. **index.ts** — Bun HTTP 서버 (CORS 프록시)
   - `/api/config` — 환경변수 기반 프로바이더 활성화 상태 전송
   - `/api/generate` — 클라이언트 요청 받아 AI API 호출 후 정규화된 코드 반환
   - 에러 처리 (503, 429 등 API 상태별 사용자 메시지)

2. **generator.ts** — 순수 함수: AI 응답 → react-live 호환 코드
   - `stripCodeFences()` — 마크다운 펜스 제거
   - `ensureRenderCall()` — render() 호출 자동 주입

3. **fallback.ts** — 순수 함수: 모델 폴백 체인
   - `withModelFallback()` — 모델 배열을 순서대로 시도, 첫 성공 반환

## Tech Stack & Constraints

- **Runtime**: Bun (Node.js 대체, 더 빠름)
- **타입**: TypeScript, Bun 타입 (`@types/bun`)
- **HTTP**: Bun.serve() (Express 없음)
- **환경변수**: `process.env.ANTHROPIC_API_KEY`, `process.env.GOOGLE_API_KEY`

**주의**: `Node.js` 함수 (예: `fs`, `path`)는 Bun 내장으로 대체 가능하지만, 필요 없으면 import 금지.

## Implementation Patterns

### 1. API 응답 구조

모든 엔드포인트는 CORS 헤더 포함 (index.ts:51-55):

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

성공 응답:
```typescript
Response.json({ code: string }, { headers: CORS_HEADERS })
Response.json({ envKeys: Record<Provider, boolean> }, { headers: CORS_HEADERS })
```

에러 응답 (항상 status + CORS 헤더):
```typescript
Response.json(
  { error: 'User-friendly message' },
  { status: 400, headers: CORS_HEADERS }
)
```

### 2. API 키 해석 우선순위

클라이언트 키 > 환경변수 (index.ts:64-66):

```typescript
function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}
```

- 클라이언트 제공 키 우선 (UI에서 입력한 경우)
- 없으면 서버 환경변수 사용 (.env)
- 둘 다 없으면 null (400 에러 반환)

### 3. 모델별 처리 분기

```typescript
const text =
  provider === 'google'
    ? await callGoogle(prompt, resolvedKey)
    : await callAnthropic(prompt, resolvedKey);
```

**Google**: `withModelFallback` 필수 (불안정, 폴백 필요)
**Anthropic**: 단일 호출 (안정적)

### 4. 순수 함수 작성 규칙

`generator.ts`, `fallback.ts`는 부수효과(side effect) 없어야 함:

**OK**:
```typescript
export function stripCodeFences(text: string): string { ... }
export async function withModelFallback<T>(...) { ... }
```

**금지**:
- `console.log()` (테스트 불가)
- 환경변수 접근 (index.ts에서만 접근)
- 파일 I/O, 네트워크 호출 (테스트 불가)

## Testing Strategy

### 실행 명령

```bash
bun test                  # 모든 테스트 한 번 실행
bun test:watch            # 파일 변경 감지해 자동 실행
```

### 테스트 필수 파일

- **generator.ts** → generator.test.ts (stripCodeFences, ensureRenderCall)
- **fallback.ts** → fallback.test.ts (withModelFallback)

### 테스트 금지 파일

- **index.ts** — 부수효과 많음 (네트워크, Bun.serve)
  - 대신 로직을 순수 함수로 추출하고 테스트

### 테스트 패턴

`vitest` + 순수 함수 테스트만 가능:

```typescript
import { describe, it, expect } from 'vitest';
import { stripCodeFences } from './generator';

describe('stripCodeFences', () => {
  it('마크다운 펜스를 제거한다', () => {
    expect(stripCodeFences('```tsx\ncode\n```')).toBe('code');
  });
});
```

## Local Golden Rules

### 1. 코드 정규화 순서 고정
**Do**: `stripCodeFences()` → `ensureRenderCall()` 순서 고정 (index.ts:188).

**Don't**: 순서 바꾸기, 한 단계 생략하기.

**Why**: 마크다운 펜스 안의 render 호출 감지 위해 먼저 펜스 제거 필수.

**How to apply**:
```typescript
const code = ensureRenderCall(stripCodeFences(text));
```

**Reference**: `server/index.ts:188`, `server/generator.ts:1-3`

---

### 2. Google 모델은 폴백 필수
**Do**: Google 모델 추가/변경 시 `GOOGLE_MODELS` 배열 유지, `withModelFallback` 호출.

**Don't**: 단일 Google 모델 호출, 폴백 제거.

**Why**: Gemini API는 quota/rate limit이 불안정하므로, 폴백 체인으로 안정성 확보 (index.ts:5, 134-136).

**How to apply**:
```typescript
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];
return withModelFallback(GOOGLE_MODELS, (model) => callGoogleModel(...));
```

**Reference**: `server/index.ts:5, 134-136`

---

### 3. API 키 응답 금지
**Do**: 환경변수 존재 여부만 boolean으로 응답 (index.ts:147-156).

**Don't**: API 키 값, 프로바이더명, 모델명을 응답에 포함.

**Why**: 응답이 브라우저 네트워크 탭에 노출되므로, 민감한 정보는 절대 포함 금지.

**How to apply**:
```typescript
// ✓ OK
Response.json({ envKeys: { anthropic: true, google: false } })

// ✗ 금지
Response.json({ apiKey: 'sk-ant-...', models: ['claude-3'] })
```

**Reference**: `server/index.ts:147-156`

---

### 4. 에러 메시지 사용자 친화적 처리
**Do**: 503, 429, 기타 API 에러를 한국어 사용자 메시지로 변환 (index.ts:194-206).

**Don't**: 원시 API 에러, 상세 기술 메시지 노출 (스택 트레이스 등).

**Why**: 사용자가 상황을 이해하고 조치하도록 돕기 위함 (UX 개선).

**How to apply**:
```typescript
if (message.includes('503')) {
  return Response.json(
    { error: '서버가 일시적으로 과부하 상태입니다...' },
    { status: 503, headers: CORS_HEADERS }
  );
}
```

**Reference**: `server/index.ts:194-206`

---

### 5. render() 호출 정규식 신뢰성
**Do**: `ensureRenderCall`의 정규식 `/\brender\s*\(/`을 신뢰하고, 변경 시 테스트 추가 (generator.ts:17-23).

**Don't**: 정규식 없이 문자열 포함 여부 확인, 정규식 수정 후 테스트 스킵.

**Why**: render 호출 감지는 react-live 렌더링의 필수 조건이므로, 정규식 변경은 치명적 버그 야기.

**How to apply**:
- 새로운 render 호출 패턴 감지 필요 시 정규식 수정 + 테스트 케이스 추가
- 예: arrow function, 복잡한 JSX 패턴 등

**Reference**: `server/generator.ts:17-23`, `server/generator.test.ts:20-40`

