# TDD Rule

**경고: 이 규칙은 Rigid입니다. 상황에 맞게 변형하지 마십시오.**

프로젝트의 `CLAUDE.md` 또는 `AGENTS.md`에 TDD 관련 규칙이 있으면 그것을 우선하십시오. 이 파일은 기본값(fallback)입니다.

---

## 적용 기준

### TDD를 반드시 적용해야 하는 대상

- **비즈니스 로직** — 복잡한 계산, 변환, 검증 (예: 금액 계산, 날짜 변환, 유효성 검사)
- **API 핸들러/라우트 로직** — 요청 처리, 응답 생성, 에러 처리
- **유틸 함수** — 순수 함수, 헬퍼 함수 (예: formatDate, calculateDiscount)
- **버그 수정** — 버그를 재현하는 테스트부터 작성, 그 뒤 수정 (회귀 방지)
- **상태 관리 로직** — 복잡한 상태 전이, 리듀서, 훅
- **데이터 변환** — parser, serializer, mapper

### TDD가 불필요한 대상

- **타입 정의** — TypeScript 타입은 타입 체크로 검증
- **설정 파일** — vite.config.ts, eslint.config.js, tsconfig.json 등
- **순수 UI 레이아웃** — 스타일만 있고 로직 없는 컴포넌트 (예: `<div className="card">`)
- **SQL 쿼리** — 데이터베이스 마이그레이션, 스키마 (별도 통합 테스트)
- **선언적 설정** — const EXAMPLES = [...], const COLORS = {...}
- **일회성 스크립트** — 데이터 마이그레이션, 초기화 스크립트

---

## RED-GREEN-REFACTOR 사이클

### 1단계: RED (실패하는 테스트 작성)

**규칙**:
- **하나의 동작 = 하나의 테스트**. 여러 동작을 하나의 테스트에 묶지 말 것.
- **반드시 실행해서 실패 확인**. 테스트는 항상 빨간색(실패)으로 시작.
- **실패 이유가 "기능 미구현"이어야 함**. "Cannot find module", 타입 에러 등은 안 됨.
  - 예: `Expected true but got false` (OK) vs `Cannot find x` (NG)

**체크리스트**:
- `bun test` 실행 후 테스트가 빨간색인가?
- 에러 메시지가 명확한가?
- 프로덕션 코드 미작성 상태인가?

**예시**:
```typescript
// 테스트: stripCodeFences 함수 아직 존재하지 않음
import { stripCodeFences } from './generator';

it('마크다운 펜스를 제거한다', () => {
  expect(stripCodeFences('```js\ncode\n```')).toBe('code');
});
// ❌ 실행 시 "Cannot find stripCodeFences" (올바른 RED)
```

### 2단계: GREEN (최소한의 코드로 통과)

**규칙**:
- **최소한의 코드만 작성**. 하드코딩 OK, 중복 OK, 일시적 조건부 OK.
- **YAGNI 원칙**: 지금 필요 없는 것은 작성하지 말 것.
- **신규 테스트 + 기존 테스트 모두 통과** 확인.

**체크리스트**:
- `bun test` 실행 후 모든 테스트가 초록색인가?
- 프로덕션 코드를 최소한으로 작성했는가?
- 다른 테스트를 깨뜨렸는가?

**예시**:
```typescript
// 프로덕션 코드
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```.*?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}
// ✓ 정확하지 않아도 이 테스트를 통과하면 OK
// ✓ 하드코딩도 가능: return text.slice(8, -3);
```

### 3단계: REFACTOR (개선)

**규칙**:
- **중복 제거, 이름 개선, 헬퍼 추출**만 수행.
- **green 상태 유지**. 새로운 동작 추가하지 말 것.
- 리팩토링 후 `bun test` 실행해서 여전히 통과하는지 확인.

**체크리스트**:
- 코드 중복이 있는가? 제거.
- 변수명/함수명이 명확한가? 개선.
- `bun test` 여전히 초록색인가?
- 새로운 기능을 추가했는가? (금지)

**예시**:
```typescript
// 리팩토링 전
export function stripCodeFences(text: string): string {
  const step1 = text.replace(/^```.*?\n?/gm, '');
  const step2 = step1.replace(/```$/gm, '');
  return step2.trim();
}

// 리팩토링 후
const OPEN_FENCE = /^```.*?\n?/gm;
const CLOSE_FENCE = /```$/gm;

export function stripCodeFences(text: string): string {
  return text
    .replace(OPEN_FENCE, '')
    .replace(CLOSE_FENCE, '')
    .trim();
}
// ✓ 명확성 개선, 중복 제거, 테스트 여전히 통과
```

### 4단계: 반복

다음 동작에 대해 **RED로 돌아가기**. 사이클 반복.

---

## 삭제 강제 규칙

### 테스트 전에 프로덕션 코드를 먼저 작성했다면 삭제하고 RED부터 재시작

**상황**: 이미 작성된 함수가 있는데 테스트를 추가하는 경우.

**정책**:
- 기존 코드는 **모두 삭제**.
- RED(테스트 실패)부터 다시 시작.
- 테스트 주도로 재작성.

**근거**: 
- 기존 코드에 숨겨진 가정이 있을 수 있음.
- TDD를 제대로 따르려면 설계부터 테스트로 주도해야 함.

**예시 (금지)**:
```typescript
// ❌ 금지: 기존 코드 유지 + 테스트 추가
export function stripCodeFences(text: string): string {
  // 기존 구현 (이미 존재)
  return text.replace(/```/g, '');
}

// 새로 작성한 테스트
it('펜스를 제거한다', () => {
  expect(stripCodeFences('```js\ncode\n```')).toBe('code');
});
// 이미 통과할 가능성 있음 → 설계 이점 상실
```

**예시 (허용)**:
```typescript
// ✓ 올바른 방법: 기존 코드 삭제, RED부터 시작

// 1단계: RED (기존 코드 삭제)
// export function stripCodeFences(text: string): string { ... }
// ↓ 삭제

// 2단계: 테스트 작성 후 실패 확인
it('펜스를 제거한다', () => {
  expect(stripCodeFences('```js\ncode\n```')).toBe('code');
});
// ❌ Cannot find stripCodeFences

// 3단계: GREEN
export function stripCodeFences(text: string): string {
  return text.replace(/```/g, '').trim();
}
```

### "참고용"으로 남기는 것도 금지

**규칙**: 기존 코드는 주석 처리, "나중에 참고하려고", "백업용"으로 유지하지 말 것.

- Git 히스토리로 복구 가능.
- 참고용 코드는 혼란과 기술 부채 야기.

---

## 변명 차단표

| 변명 | 반론 |
|------|------|
| **"너무 단순해서 테스트 불필요"** | 단순한 코드일수록 테스트가 명확. 5줄짜리 함수도 엣지 케이스 있음. |
| **"나중에 테스트 추가하겠다"** | 나중은 절대 오지 않음. 테스트 없이 진행된 코드는 회귀 위험 증가, 리팩토링 불가능. |
| **"시간이 없다"** | TDD가 더 빠름. 수동 테스트→디버깅→수정 반복의 낭비를 제거. |
| **"삭제하면 낭비"** | 작동하지 않는 코드는 기술 부채. 낭비는 코드 존재, 테스트 재작성이 아님. |
| **"프로토타입이다"** | 프로토타입→프로덕션이 70% 이상. TDD로 처음부터 품질 확보. |
| **"버그 고칠 시간 없다"** | TDD 없이 고치면 다시 터짐(회귀). 버그 테스트+수정이 장기적으로 더 빠름. |
| **"테스트 너무 많아진다"** | 많은 테스트 = 신뢰도 높음. 많은 테스트 없이 리팩토링 못 함. |
| **"설계 변경되면 테스트도 다 바꿔야 한다"** | 테스트는 계약(contract). 계약 변경 시 양쪽(구현+테스트)이 일치해야 함. 이것이 설계의 영향도 명확히 함. |

---

## 프로젝트별 규칙 우선 조항

**최우선 순서**:
1. 프로젝트 루트 `AGENTS.md` → **Local Golden Rules** (테스트 관련)
2. 프로젝트 루트 `CLAUDE.md` (명시된 규칙)
3. 하위 폴더 `AGENTS.md` (예: `server/AGENTS.md`, `src/AGENTS.md`)
4. **이 파일** (`.claude/rules/tdd.md`)

**예시**:
프로젝트의 `server/AGENTS.md`에 "generator.ts와 fallback.ts는 반드시 테스트하고, index.ts는 통합 테스트만 가능"이라고 명시되어 있으면, 이 규칙이 이 파일보다 우선합니다.

---

## 체크리스트 (각 기능 추가 전)

- [ ] TDD 적용 대상인가? (비즈니스 로직, API, 유틸, 버그 수정)
- [ ] RED: 테스트 작성 후 실패 확인했는가?
- [ ] GREEN: 최소 코드로 통과했는가?
- [ ] 기존 테스트도 모두 통과하는가?
- [ ] REFACTOR: 중복/이름 개선 후 여전히 통과하는가?
- [ ] 프로젝트별 규칙과 충돌하는가?

