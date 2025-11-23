# 톤필드 3D 메쉬 외형 구현 분석 문서

## 개요
이 문서는 현재 프로젝트의 3D 메쉬 톤필드 외형 구현 코드와 로직을 정리한 것으로, 전문가 분석을 위한 기술 사양서입니다.

**목적**: 톤필드 내부를 4개 영역으로 분할하고, 각 영역에 개별 또는 통합적으로 그라디언트 색상을 적용하여 조율 오차에 따른 장력을 색상으로 시각화하고자 합니다.

---

## 1. 현재 구현 구조

### 1.1 주요 파일 구조
- `frontend/src/components/ToneField3D.tsx`: 재사용 가능한 3D 톤필드 컴포넌트
- `frontend/src/components/ToneField.tsx`: 메인 톤필드 컴포넌트 (UI 포함)
- `frontend/src/lib/tonefield-calculation.ts`: 타점 계산 로직
- `frontend/src/components/TensionScene.tsx`: 장력 시각화 (대안 접근)

### 1.2 기술 스택
- **3D 라이브러리**: Three.js (via @react-three/fiber, @react-three/drei)
- **렌더링**: WebGL (Canvas)
- **언어**: TypeScript / React

---

## 2. 지오메트리 생성 로직

### 2.1 타원형 메쉬 생성 함수
**위치**: `ToneField3D.tsx` (37-96줄), `ToneField.tsx` (10-93줄)

```typescript
function createTonefieldGeometry(
  width: number,      // 0.6 (X축 반지름의 2배)
  height: number,     // 0.85 (Z축 반지름의 2배)
  radialSegments: number,  // 64 (원주 방향 세그먼트)
  ringSegments: number      // 32 (반경 방향 세그먼트)
)
```

#### 2.1.1 좌표계
- **평면 좌표**: 극좌표계 (r, θ) 사용
  - `r`: 0 ~ 1 (정규화된 반지름)
  - `θ`: 0 ~ 2π (각도)
- **3D 변환**:
  ```typescript
  x = r * cos(θ) * (width / 2)   // X축: 0.3
  z = r * sin(θ) * (height / 2)  // Z축: 0.425
  ```

#### 2.1.2 딤플(Dimple) 구현
**위치**: `ToneField3D.tsx` (53-69줄)

```typescript
const dimpleRadius = 0.35;        // 내부 딤플 경계 (정규화된 반지름)
const dimpleHeight = 0.04;         // 딤플 돔 높이
const transitionWidth = 0.05;      // 전환 구간 너비

// 높이 계산 로직
if (r < dimpleRadius - transitionWidth) {
  // 딤플 내부: 포물선 돔
  const r_norm = r / (dimpleRadius - transitionWidth);
  y = dimpleHeight * (1 - r_norm * r_norm);
} else if (r < dimpleRadius + transitionWidth) {
  // 전환 구간: 코사인 보간
  const t = (r - (dimpleRadius - transitionWidth)) / (2 * transitionWidth);
  const r_norm = (dimpleRadius - transitionWidth) / (dimpleRadius - transitionWidth);
  const domeHeight = dimpleHeight * (1 - r_norm * r_norm);
  y = domeHeight * (1 - t) * Math.cos(t * Math.PI / 2);
} else {
  // 외부: 평면
  y = 0;
}
```

**특징**:
- 중심부에 부드러운 돔 형태의 딤플
- 전환 구간에서 부드러운 블렌딩
- 타원형으로 확장 (X축과 Z축 비율 유지)

#### 2.1.3 메쉬 인덱싱
- **정점 배열**: `(ringSegments + 1) × (radialSegments + 1)` 개
- **삼각형 구성**: 각 쿼드를 2개의 삼각형으로 분할
- **UV 좌표**: 텍스처 매핑용 (현재 미사용)

---

## 3. 색상 매핑 로직

### 3.1 현재 색상 시스템
**위치**: `ToneField3D.tsx` (105-131줄), `ToneField.tsx` (109-160줄)

#### 3.1.1 HSL 기반 색상 계산
```typescript
// 높이 기반 색상 매핑
const h = THREE.MathUtils.clamp(y, 0, 1);  // 높이 정규화

// 전역 장력에 따른 기본 색상
const baseHue = 0.6 * (1 - tension);  // 0.6 (파란색) → 0.0 (빨간색)

// 높이에 따른 색상 변화
const hueShift = 0.2 * h;
let finalHue = baseHue - hueShift;
if (finalHue < 0) finalHue += 1;

// 채도 및 명도
const s = 1.0;  // 최대 채도
const l = 0.5 + 0.3 * h;  // 높이에 따라 밝기 증가

color.setHSL(finalHue, s, l);
```

#### 3.1.2 색상 의미
- **높은 장력 (tension = 1.0)**: 빨간색/주황색 (따뜻한 색)
- **낮은 장력 (tension = 0.0)**: 파란색/보라색 (차가운 색)
- **높이 (h)**: 딤플 중심부가 더 밝고 따뜻한 색

#### 3.1.3 제한사항
- 현재는 **전역 장력(tension)** 값 하나만 사용
- **조율 오차(tonicError, octaveError, fifthError)**를 직접 반영하지 않음
- 영역별 색상 구분 없음

---

## 4. 경계선 및 시각화 요소

### 4.1 타원 경계선
**위치**: `ToneField3D.tsx` (147-198줄), `ToneField.tsx` (183-326줄)

#### 4.1.1 외부 타원 경계선
```typescript
const outerLine = new THREE.EllipseCurve(
  0, 0,              // 중심
  0.3, 0.425,        // X축 반지름, Z축 반지름
  0, 2 * Math.PI,    // 시작 각도, 끝 각도
  false,             // 시계방향 여부
  0                  // 회전
);
```

#### 4.1.2 내부 딤플 경계선
```typescript
const innerLine = new THREE.EllipseCurve(
  0, 0,
  0.3 * 0.35, 0.425 * 0.35,  // 외부의 35%
  0, 2 * Math.PI,
  false,
  0
);
```

#### 4.1.3 색상 및 스타일
- **기본 상태**: 회색 (#808080), 투명도 80%
- **내부 타점**: 파란색 (#3b82f6), 투명도 100%
- **외부 타점**: 빨간색 (#dc2626), 투명도 100%

### 4.2 대각선 점선
**위치**: `ToneField.tsx` (243-310줄)

#### 4.2.1 구현
```typescript
// 4개의 대각선 방향 (45도, 135도, 225도, 315도)
const angles = [
  Math.PI / 4,       // 45도 (오른쪽 위)
  3 * Math.PI / 4,   // 135도 (왼쪽 위)
  5 * Math.PI / 4,   // 225도 (왼쪽 아래)
  7 * Math.PI / 4    // 315도 (오른쪽 아래)
];

// 각 방향마다 2개의 선분 (중심을 사이에 두고 양쪽)
// LineDashedMaterial 사용
const material = new THREE.LineDashedMaterial({
  color: color,
  transparent: true,
  opacity: opacity,
  linewidth: 1,
  dashSize: 0.02,
  gapSize: 0.01
});
```

**특징**:
- 4개의 대각선이 톤필드를 4개 영역으로 나눔
- 점선 스타일로 표시
- 타원 경계선과 동일한 색상 사용

---

## 5. 재료(Material) 설정

### 5.1 메쉬 재료
**위치**: `ToneField3D.tsx` (135-142줄)

```typescript
<meshStandardMaterial
  vertexColors          // 정점별 색상 사용
  wireframe={wireframe} // 와이어프레임 모드
  side={THREE.DoubleSide}
  metalness={0.5}      // 금속성
  roughness={0.2}       // 거칠기
  color={wireframe ? "cyan" : "white"}
/>
```

---

## 6. 조율 오차 데이터 구조

### 6.1 조율 오차 값
**위치**: `tonefield-calculation.ts` (25-29줄)

```typescript
interface TuningErrors {
  tonic: number;    // 실제로는 fifthError (토닉 오차)
  octave: number;   // 옥타브 오차
  fifth: number;    // 실제로는 tonicError (5도 오차)
}
```

**주의**: 변수명과 실제 의미가 반대입니다.
- `tonicError` 상태 → `fifth` 필드 (5도 오차)
- `fifthError` 상태 → `tonic` 필드 (토닉 오차)

### 6.2 좌표계 매핑
**위치**: `tonefield-calculation.ts` (48-117줄)

- **토닉(Tonic)**: Y축 (음수 방향 = 내부)
- **옥타브(Octave)**: Y축 (양수 방향 = 외부)
- **5도(Fifth)**: X축 (양수/음수 = 좌우)

---

## 7. 현재 구현의 한계점

### 7.1 색상 시스템
1. **전역 장력만 사용**: 조율 오차(tonicError, octaveError, fifthError)를 직접 반영하지 않음
2. **영역별 구분 없음**: 4개 영역을 구분하지 않음
3. **그라디언트 제한**: 높이(y) 기반 단순 그라디언트만 사용

### 7.2 영역 분할
1. **대각선은 시각적 요소**: 실제로 메쉬를 4개 영역으로 나누지 않음
2. **영역 식별 로직 없음**: 각 정점이 어느 영역에 속하는지 판단하는 로직 없음

### 7.3 데이터 연동
1. **조율 오차 미반영**: `ToneFieldMesh` 컴포넌트가 `tension` prop만 받고, 조율 오차는 받지 않음
2. **장력 계산 없음**: 조율 오차를 장력으로 변환하는 로직 없음

---

## 8. 요구사항: 4개 영역 그라디언트 색상

### 8.1 목표
톤필드를 4개 영역으로 나누고, 각 영역에 조율 오차에 따른 장력을 색상으로 표시:

1. **영역 분할**:
   - 대각선(45°, 135°, 225°, 315°)을 기준으로 4개 영역
   - 각 정점이 어느 영역에 속하는지 판단

2. **색상 매핑**:
   - 각 영역별로 조율 오차에 따른 장력 계산
   - 영역 내부에서 그라디언트 적용
   - 필요시 영역 간 통합 그라디언트

3. **장력 계산**:
   - `tonicError`, `octaveError`, `fifthError`를 장력 값으로 변환
   - 영역별로 다른 가중치 적용 가능

### 8.2 영역 정의
```
        Y (옥타브 +)
        ↑
        |
   영역2 | 영역1
   -----+-----→ X (5도 +)
   영역3 | 영역4
        |
```

- **영역 1**: X > 0, Y > 0 (오른쪽 위)
- **영역 2**: X < 0, Y > 0 (왼쪽 위)
- **영역 3**: X < 0, Y < 0 (왼쪽 아래)
- **영역 4**: X > 0, Y < 0 (오른쪽 아래)

---

## 9. 전문가 분석 요청 사항

### 9.1 구현 방안 문의
1. **영역 분할 방법**:
   - 정점별로 영역을 판단하는 최적의 방법은?
   - 극좌표계에서 각도 기반 분할 vs 직교 좌표계 분할?

2. **색상 그라디언트**:
   - 영역별 독립 그라디언트 vs 통합 그라디언트?
   - 조율 오차를 장력 값으로 변환하는 공식?
   - 영역 경계에서 부드러운 블렌딩 방법?

3. **성능 최적화**:
   - 정점별 색상 계산을 `useEffect`에서 하는 것이 적절한가?
   - `useFrame`에서 실시간 업데이트가 필요한가?
   - Geometry를 재생성하지 않고 색상만 업데이트하는 방법?

4. **시각화 개선**:
   - 영역 경계를 시각적으로 강조하는 방법?
   - 조율 오차가 0일 때와 큰 값일 때의 색상 대비?

### 9.2 코드 구조 개선
1. **컴포넌트 분리**:
   - 색상 계산 로직을 별도 함수로 분리?
   - 영역 판단 로직을 유틸리티 함수로?

2. **데이터 흐름**:
   - `ToneFieldMesh`가 조율 오차를 직접 받도록 수정?
   - 장력 계산 로직을 `tonefield-calculation.ts`에 추가?

---

## 10. 참고 코드 위치

### 10.1 핵심 함수
- **지오메트리 생성**: `ToneField3D.tsx:37-96`, `ToneField.tsx:10-93`
- **색상 매핑**: `ToneField3D.tsx:105-131`, `ToneField.tsx:109-160`
- **경계선 렌더링**: `ToneField3D.tsx:147-198`, `ToneField.tsx:183-326`
- **대각선 점선**: `ToneField.tsx:243-310`

### 10.2 계산 로직
- **타점 좌표 계산**: `tonefield-calculation.ts:48-117`
- **조율 대상 계산**: `tonefield-calculation.ts:239-311`

---

## 11. 추가 고려사항

### 11.1 좌표계 불일치
- `ToneField3D.tsx`는 Y축을 높이로 사용 (rotation.x = -π/2)
- `ToneField.tsx`는 Z축을 높이로 사용 (XY 평면)
- 두 컴포넌트 간 좌표계 통일 필요

### 11.2 성능
- 현재 `radialSegments: 64, ringSegments: 32` → 약 2,112개 정점
- 색상 업데이트 시 모든 정점을 순회 (O(n))
- 실시간 업데이트 시 성능 고려 필요

---

## 12. 결론

현재 구현은 기본적인 3D 톤필드 메쉬와 색상 시스템을 갖추고 있으나, **조율 오차를 영역별로 시각화하는 기능이 없습니다**. 

**요구사항 달성을 위해 필요한 작업**:
1. 영역 분할 로직 구현
2. 조율 오차 → 장력 변환 공식 정의
3. 영역별 색상 계산 로직 구현
4. 그라디언트 블렌딩 알고리즘 적용

전문가의 조언을 통해 최적의 구현 방안을 결정하고자 합니다.




