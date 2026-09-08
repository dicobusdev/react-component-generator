# src/AGENTS.md

React 19 프론트엔드. 프롬프트 입력 → 서버 API 호출 → react-live를 통한 실시간 렌더링 + 코드 전시.

## Module Context

`src/`는 다섯 가지 주요 부분으로 구성됩니다:

1. **App.tsx** — 메인 컨테이너
   - 프로바이더 선택 (Anthropic / Google)
   - API 키 입력 UI (password 필드)
   - 생성된 컴포넌트 목록 관리

2. **hooks/useComponentGenerator.ts** — 상태 관리
   - `/api/generate` 호출
   - 생성된 컴포넌트 배열 유지
   - 로딩/에러 상태

3. **components/** — UI 컴포넌트
   - **PromptInput.tsx** — 프롬프트 입력 + 예시 칩 (테스트 있음)
   - **ComponentCard.tsx** — 미리보기/코드 탭 (테스트 없음)
   - **LivePreview.tsx** — react-live 렌더링 (noInline 모드)
   - **CodeView.tsx** — 코드 복사 기능

4. **types/index.ts** — 타입 정의
   - `Provider` — 'anthropic' | 'google'
   - `GeneratedComponent` — 생성된 컴포넌트 구조

5. **CSS** — App.css, index.css (Vite 번들)

## Tech Stack & Constraints

- **React**: 19.2.4 (함수형 컴포넌트만 사용)
- **런타임 렌더링**: react-live 4.1.8 (`noInline={true}` 모드)
  - 생성된 코드는 `render(<Component />)` 호출 필수
  - TypeScript 문법 금지 (javascript만 가능)
  - React는 전역 스코프에서만 사용 가능
- **상태 관리**: React.useState, useCallback (외부 라이브러리 없음)
- **테스트**: Vitest + @testing-library/react

**주의**: 
- Vite는 환경변수를 `import.meta.env`로만 노출 (process.env 미지원)
- API 키는 클라이언트에 노출될 수 없으므로, `/api/config`로만 boolean 확인

## Implementation Patterns

### 1. 프로바이더 타입 사용

모든 프로바이더 참조는 `Provider` 타입 사용 (types/index.ts:1):

```typescript
import type { Provider } from '../types';

const provider: Provider = 'anthropic';  // ✓ 타입 안전

// ✗ 금지: 문자열 리터럴
const provider: string = 'anthropic';
```

**이유**: 프로바이더 추가/제거 시 TypeScript가 자동 감지.

### 2. API 호출 패턴

`useComponentGenerator` 훅의 `generate` 함수 (hooks/useComponentGenerator.ts:18-49):

```typescript
const generate = useCallback(async (
  prompt: string,
  apiKey: string | undefined,
  provider: Provider
) => {
  setIsLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    // 컴포넌트 추가
  } catch (err) {
    setError(...);
  } finally {
    setIsLoading(false);
  }
}, []);
```

**패턴**:
- 요청 전 `setIsLoading(true)`, `setError(null)`
- 응답 `!res.ok` 확인 (에러 처리)
- try/catch로 네트워크 에러 처리
- 항상 finally에서 `setIsLoading(false)`

### 3. 컴포넌트 ID 생성

`useComponentGenerator`에서 고유 ID 생성 (hooks/useComponentGenerator.ts:36):

```typescript
id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
```

**이유**: 서버 없이 클라이언트에서 고유성 보장. UUID 라이브러리 불필요.

### 4. 프로바이더 전환 시 API 키 초기화

`App.tsx:41-44`:

```typescript
const handleProviderChange = (newProvider: Provider) => {
  setProvider(newProvider);
  setApiKey('');  // 이전 프로바이더 키 제거
};
```

**이유**: 다른 프로바이더의 키를 실수로 사용하지 않도록 보호.

### 5. react-live 호환 코드 조건

생성된 컴포넌트는 다음을 만족해야 함 (LivePreview.tsx:14):

```typescript
<LiveProvider code={code} noInline>
  <ReactLivePreview />
  <LiveError />
</LiveProvider>
```

조건:
1. `render(<ComponentName />)` 호출 필수 (마지막 줄)
2. TypeScript 문법 금지 (`as`, type annotation)
3. React는 전역 `React.*` 접근만 가능
4. CSS import, 외부 모듈 import 금지

## Testing Strategy

### 실행 명령

```bash
bun test               # 모든 테스트 한 번 실행
bun test:watch         # 파일 변경 감지해 자동 실행
```

### 테스트 대상

**있음 (테스트 커버리지):**
- `components/PromptInput.test.tsx` — 입력/제출/로딩 상태

**없음 (추후 추가 권장):**
- `components/ComponentCard.tsx` — 탭 전환, 새로고침, 재생성
- `components/LivePreview.tsx` — react-live 에러 렌더링
- `components/CodeView.tsx` — 복사 기능
- `hooks/useComponentGenerator.ts` — API 호출, 상태 변경

### 테스트 작성 가이드

`@testing-library/react` + vitest 패턴:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ComponentName', () => {
  it('사용자 액션 후 상태 변경을 확인한다', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

## Local Golden Rules

### 1. react-live 코드 검증 책임
**Do**: 서버에서 `stripCodeFences()` + `ensureRenderCall()` 적용 후 응답.

**Don't**: 클라이언트에서 생성된 코드 수정/정규화.

**Why**: 코드 신뢰성은 서버에서 보장해야 하고, 클라이언트는 그대로 렌더링만 담당 (관심사 분리).

**How to apply**:
- LivePreview는 서버 응답 코드를 그대로 `<LiveProvider code={code}>`에 전달
- 코드 수정이 필요하면 서버의 generator.ts에서 처리

**Reference**: `src/components/LivePreview.tsx:14`, `server/index.ts:188`

---

### 2. 프로바이더 전환 = API 키 초기화
**Do**: 프로바이더 변경 시 `setApiKey('')` 호출 (App.tsx:43).

**Don't**: 이전 프로바이더 키 유지, 다른 프로바이더로 전송.

**Why**: Anthropic 키를 Google에 보내거나 역으로 보내면 401 에러 발생, 사용자 혼란.

**How to apply**:
```typescript
const handleProviderChange = (newProvider: Provider) => {
  setProvider(newProvider);
  setApiKey('');  // 필수
};
```

**Reference**: `src/App.tsx:41-44`

---

### 3. 에러 메시지는 서버 응답 우선
**Do**: 에러 UI는 `data.error` (서버 메시지) 표시 (hooks/useComponentGenerator.ts:32).

**Don't**: 자체 에러 메시지 작성, 기술 에러 노출.

**Why**: 서버가 API 상태(503, 429)별 사용자 친화적 메시지 제공하므로, 클라이언트는 그대로 전달만.

**How to apply**:
```typescript
const data = await res.json();
if (!res.ok) {
  throw new Error(data.error || 'Failed to generate component');
}
```

**Reference**: `src/hooks/useComponentGenerator.ts:29-33`

---

### 4. API 키 입력 필드는 password 타입 유지
**Do**: API 키 입력 필드는 `type={showKey ? 'text' : 'password'}` (App.tsx:98-101).

**Don't**: `type="text"` 고정, 숨기기 버튼 제거.

**Why**: 키보드/화면 공유 시 키가 노출되지 않도록 보호.

**How to apply**:
```typescript
<input
  type={showKey ? 'text' : 'password'}
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
/>
<button onClick={() => setShowKey(!showKey)}>
  {showKey ? '숨기기' : '보기'}
</button>
```

**Reference**: `src/App.tsx:98-115`

---

### 5. 환경변수 boolean 상태만 신뢰
**Do**: `/api/config` 응답의 `envKeys` boolean으로 UI 상태 결정 (App.tsx:24-28).

**Don't**: 로컬 상태로 키 존재 여부 추측, 환경변수 직접 읽기.

**Why**: 서버만 `process.env` 접근 가능하므로, 클라이언트는 서버 응답만 신뢰.

**How to apply**:
```typescript
useEffect(() => {
  fetch('/api/config')
    .then((res) => res.json())
    .then((data) => setEnvKeys(data.envKeys))
    .catch(() => {});  // 네트워크 에러는 무시 (UI 기본값 사용)
}, []);

const hasEnvKey = envKeys[provider];
```

**Reference**: `src/App.tsx:24-31`

