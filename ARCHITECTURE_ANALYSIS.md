# 아키텍처 분석: 좌표계 통합 전략

## 현재 시스템 구조 분석

### 포함된 기능들
1. **3D 좌표계 시각화** (핵심)
   - 톤필드 메시 렌더링
   - 타원 경계선
   - 타점 마커
   - 좌표 그리드

2. **조율 오차 입력 UI**
   - 5도, 옥타브, 토닉 입력 필드
   - 자동 하이라이트

3. **타점 계산 알고리즘** (비즈니스 로직)
   - 조율 오차 → 타점 좌표 변환
   - 강도/타수 계산
   - 해머링 타입 결정
   - 물리 상수 기반 계산

4. **데이터 관리**
   - Supabase 연동
   - 타점 저장/조회/삭제
   - 최근 타점 표시

5. **UI 컨트롤**
   - 카메라 뷰 전환
   - Tension 슬라이더
   - Wireframe 토글

---

## 접근 방식 비교

### 방식 1: 전체 기능 포함 (Monolithic iframe)

**구조:**
```
[외부 웹페이지]
  └─ <iframe src="https://your-app.com/full">
       └─ [전체 ToneField 컴포넌트]
            ├─ 좌표계 시각화
            ├─ 조율 오차 입력 UI
            ├─ 타점 계산 알고리즘
            ├─ 데이터 저장소 (Supabase)
            └─ 모든 UI 컨트롤
```

**장점:**
- ✅ **빠른 통합**: 복사-붙여넣기만으로 완전한 기능 제공
- ✅ **일관성**: 모든 사용자가 동일한 UI/UX 경험
- ✅ **유지보수**: 알고리즘 업데이트 시 모든 곳에 자동 반영
- ✅ **데이터 중앙화**: 모든 타점 데이터가 한 곳에 저장

**단점:**
- ❌ **커스터마이징 제한**: 외부 웹페이지에서 UI 변경 어려움
- ❌ **번들 크기**: 불필요한 기능까지 포함되어 무거움
- ❌ **의존성**: Supabase 등 외부 서비스에 강하게 결합
- ❌ **스타일링 제한**: iframe 내부 스타일 변경 어려움
- ❌ **데이터 격리**: 각 웹페이지가 독립적인 데이터를 원할 경우 문제

**적합한 경우:**
- 표준화된 솔루션이 필요한 경우
- 빠른 프로토타이핑
- 중앙 집중식 데이터 관리가 필요한 경우
- UI/UX 일관성이 중요한 경우

---

### 방식 2: 좌표계만 제공 (Headless Component)

**구조:**
```
[외부 웹페이지]
  ├─ [자체 조율 오차 입력 UI]
  ├─ [자체 타점 계산 로직] (또는 API 호출)
  ├─ [자체 데이터 저장소]
  └─ <ToneField3D 
        hitPointLocation={...}
        hitPointCoordinate={...}
        ... />
       └─ [좌표계 시각화만]
```

**장점:**
- ✅ **완전한 커스터마이징**: 각 웹페이지가 자체 UI/로직 구현
- ✅ **경량**: 필요한 기능만 포함
- ✅ **유연성**: 다양한 사용 사례에 대응 가능
- ✅ **독립성**: 외부 의존성 없이 사용 가능
- ✅ **데이터 분리**: 각 웹페이지가 자체 데이터 관리

**단점:**
- ❌ **구현 복잡도**: 각 웹페이지에서 알고리즘 재구현 필요
- ❌ **일관성 부족**: 구현 방식에 따라 결과가 다를 수 있음
- ❌ **유지보수**: 알고리즘 변경 시 모든 곳에 수동 업데이트 필요
- ❌ **개발 시간**: 초기 통합에 더 많은 시간 소요

**적합한 경우:**
- 각 웹페이지가 고유한 UI/UX가 필요한 경우
- 데이터를 독립적으로 관리해야 하는 경우
- 알고리즘을 커스터마이징해야 하는 경우
- React 기반 프로젝트

---

### 방식 3: 하이브리드 접근 (권장) ⭐

**구조:**
```
[외부 웹페이지]
  └─ <ToneFieldEmbed 
        mode="visualization-only" | "full" | "custom"
        features={["visualization", "calculation"]}
        dataSource="external" | "internal"
        ... />
```

**3가지 모드 제공:**

#### 모드 A: Visualization Only (좌표계만)
```tsx
<ToneField3D
  mode="visualization"
  hitPointData={hitPointData}  // 외부에서 계산된 데이터
/>
```

#### 모드 B: Full Featured (전체 기능)
```tsx
<ToneFieldFull
  mode="full"
  supabaseConfig={supabaseConfig}  // 선택적
/>
```

#### 모드 C: Custom (선택적 기능)
```tsx
<ToneFieldCustom
  mode="custom"
  features={{
    visualization: true,
    calculation: true,      // 알고리즘 포함
    dataStorage: false,    // 외부에서 데이터 관리
    uiControls: false      // 외부에서 UI 제공
  }}
  onCalculate={(errors) => {
    // 외부에서 계산 로직 커스터마이징 가능
  }}
/>
```

**장점:**
- ✅ **유연성**: 사용 사례에 맞게 선택 가능
- ✅ **점진적 통합**: 단계적으로 기능 추가 가능
- ✅ **재사용성**: 공통 알고리즘은 라이브러리로 제공
- ✅ **커스터마이징**: 필요한 부분만 커스터마이징 가능

---

## 권장 아키텍처: 계층화된 구조

```
┌─────────────────────────────────────────┐
│  Layer 1: Core Visualization           │
│  - ToneField3D (순수 시각화)            │
│  - 의존성: three.js, react-three-fiber  │
└─────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│  Layer 2: Business Logic                │
│  - 타점 계산 알고리즘 (독립 모듈)        │
│  - 물리 상수 및 규칙                     │
│  - 의존성: 없음 (순수 함수)              │
└─────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│  Layer 3: UI Components                 │
│  - 조율 오차 입력 UI                     │
│  - 타점 파라미터 표시                    │
│  - 의존성: Layer 2                       │
└─────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│  Layer 4: Data Management               │
│  - Supabase 연동 (선택적)                │
│  - 로컬 스토리지                         │
│  - API 호출                              │
└─────────────────────────────────────────┘
```

### 구현 전략

#### 1. Core Library (npm 패키지)
```typescript
// @your-org/tonefield-core
export { ToneField3D } from './visualization';
export { calculateHitPoint } from './calculation';
export { TuningErrorInput } from './ui';
```

#### 2. Full Featured Component
```typescript
// @your-org/tonefield-full
import { ToneField3D, calculateHitPoint } from '@your-org/tonefield-core';

export function ToneFieldFull() {
  // 전체 기능 통합
}
```

#### 3. iframe Embed
```typescript
// /embed 페이지
export default function EmbedPage() {
  const mode = searchParams.get('mode') || 'full';
  
  if (mode === 'visualization') {
    return <ToneField3D {...props} />;
  }
  return <ToneFieldFull {...props} />;
}
```

---

## 구체적인 권장사항

### 시나리오별 추천

#### 1. 빠른 통합이 필요한 경우
→ **방식 1 (전체 기능 포함 iframe)**
- 복사-붙여넣기로 즉시 사용
- 표준화된 솔루션 제공

#### 2. 커스터마이징이 중요한 경우
→ **방식 2 (좌표계만) + 계산 API**
- 좌표계는 컴포넌트로
- 계산 로직은 API로 제공

#### 3. 장기적 확장성 고려
→ **방식 3 (하이브리드)**
- 계층화된 구조
- npm 패키지로 배포
- 필요에 따라 조합

---

## 최종 권장 아키텍처

### 단계별 구현

#### Phase 1: 현재 상태 유지 + iframe 제공
- 전체 기능 포함 iframe (`/embed`)
- 빠른 통합 가능

#### Phase 2: Core Library 분리
- `@your-org/tonefield-core` npm 패키지
- 시각화 + 계산 로직 분리

#### Phase 3: API 서버 구축
- 계산 API 엔드포인트 제공
- 비-React 프로젝트 지원

#### Phase 4: 다양한 통합 옵션 제공
- iframe (전체 기능)
- React Component (좌표계만)
- API (계산만)
- Web Component (범용)

---

## 결론

**단기적으로는**: 전체 기능 포함 iframe으로 빠른 통합
**장기적으로는**: 계층화된 구조로 유연성 확보

**가장 효율적인 접근:**
1. **즉시 사용**: iframe으로 전체 기능 제공
2. **점진적 개선**: Core Library 분리
3. **최종 목표**: 다양한 통합 옵션 제공

