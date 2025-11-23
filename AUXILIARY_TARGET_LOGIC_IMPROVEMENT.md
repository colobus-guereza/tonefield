# 보조 조율대상 선정 로직 개선 보고서

**날짜**: 2025-11-23  
**작업**: 좌표계 사분면 기반 보조 조율대상 선정 로직 수정

---

## 문제 상황

사용자가 첨부한 이미지에서 **토닉(+20.5 Hz)**과 **옥타브(+6.4 Hz)**가 동시에 조율대상으로 선정되는 문제가 발생했습니다.

### 이전 로직의 문제점

```typescript
// ❌ 잘못된 로직
const primarySign = Math.sign(primary.value);
const auxiliary = scores
  .slice(1)
  .find(item =>
    item.value !== 0 &&
    Math.sign(item.value) === primarySign  // 단순히 부호만 비교
  );
```

**문제**: 단순히 오차 값의 **부호(+/-)만 비교**하여 보조를 선정했습니다.

---

## 좌표계 분석

### 각 조율대상의 좌표계 위치

| 조율대상 | 부호 | 좌표계 방향 | 사분면 |
|---------|------|------------|--------|
| **토닉 (+)** | 양수 | Y축 음의 방향 (아래) | 3, 4 사분면 |
| **토닉 (-)** | 음수 | Y축 양의 방향 (위) | 1, 2 사분면 |
| **옥타브 (+)** | 양수 | Y축 양의 방향 (위) | 1, 2 사분면 |
| **옥타브 (-)** | 음수 | Y축 음의 방향 (아래) | 3, 4 사분면 |
| **5도 (+)** | 양수 | X축 양의 방향 (우) | 1, 4 사분면 |
| **5도 (-)** | 음수 | X축 음의 방향 (좌) | 2, 3 사분면 |

### 왜 토닉과 옥타브가 세트가 될 수 없는가?

**핵심 원리**: 토닉과 옥타브는 **같은 Y축을 공유**하지만 **방향이 반대**입니다.

```
Y축 (위/아래)
    ↑
    │  옥타브 (+): 위쪽
────┼──── X축 (좌/우)
    │  토닉 (+): 아래쪽  ← 서로 반대 방향!
    ↓
```

첨부하신 상황에서:
- 옥타브: +6.4 Hz → Y축 **위쪽** (1, 2 사분면)
- 토닉: +20.5 Hz → Y축 **아래쪽** (3, 4 사분면)
- 두 값이 모두 **양수**라서 이전 로직으로는 "같은 부호"로 인식 ❌

---

## 개선된 로직

### ✅ 올바른 보조 선정 규칙

```typescript
// ✅ 개선된 로직 (좌표계 사분면 기반)
let auxiliary: typeof scores[0] | undefined = undefined;

if (primary.key === 'tonic' || primary.key === 'octave') {
  // Primary가 토닉 또는 옥타브인 경우 → 보조는 5도만 가능
  const fifthCandidate = scores.find(item => item.key === 'fifth' && item.value !== 0);
  if (fifthCandidate) {
    // 5도와 부호가 같은 경우에만 보조로 선정
    const primarySign = Math.sign(primary.value);
    const fifthSign = Math.sign(fifthCandidate.value);
    if (primarySign === fifthSign) {
      auxiliary = fifthCandidate;
    }
  }
} else if (primary.key === 'fifth') {
  // Primary가 5도인 경우 → 보조는 토닉 또는 옥타브 중 부호가 같은 것
  const primarySign = Math.sign(primary.value);
  const candidates = scores
    .slice(1)
    .filter(item => 
      (item.key === 'tonic' || item.key === 'octave') &&
      item.value !== 0 &&
      Math.sign(item.value) === primarySign
    );
  
  if (candidates.length > 0) {
    // 가중치 점수가 더 높은 것을 선택
    candidates.sort((a, b) => b.score - a.score);
    auxiliary = candidates[0];
  }
}
```

### 보조 선정 규칙 요약

1. **Primary가 토닉** → 보조는 **5도만 가능** (옥타브 ❌)
2. **Primary가 옥타브** → 보조는 **5도만 가능** (토닉 ❌)
3. **Primary가 5도** → 보조는 **토닉 또는 옥타브** 중 부호가 같은 것

---

## 수정된 파일

### 1. `/frontend/src/lib/tonefield-calculation.ts` (Lines 265-285)
- `calculateTuningTarget()` 함수의 보조 선정 로직 수정

### 2. `/frontend/src/components/ToneField.tsx` (Lines 583-598)
- React 컴포넌트 내 보조 선정 로직 수정 (일관성 유지)

---

## 테스트 케이스

### 예시 1: 문제 상황 (첨부 이미지)
```
입력:
- 5도: -28.8 Hz
- 옥타브: +6.4 Hz
- 토닉: +20.5 Hz

가중치:
- 토닉: 20.5 × 6 = 123.0 ← Primary
- 옥타브: 6.4 × 3 = 19.2
- 5도: 28.8 × 2 = 57.6

결과:
✅ Primary: 토닉
✅ Auxiliary: null (옥타브는 제외됨)
✅ Display: "토닉"
```

### 예시 2: 토닉 + 5도 (협력)
```
입력:
- 5도: -10.0 Hz
- 옥타브: +2.0 Hz
- 토닉: +15.0 Hz

가중치:
- 토닉: 15.0 × 6 = 90.0 ← Primary
- 5도: 10.0 × 2 = 20.0
- 옥타브: 2.0 × 3 = 6.0

부호 검증:
- Primary(토닉): 양수
- 5도: 음수 ← 부호 다름

결과:
✅ Primary: 토닉
✅ Auxiliary: null (부호가 다름)
✅ Display: "토닉"
```

### 예시 3: 5도 Primary + 옥타브 보조
```
입력:
- 5도: -20.0 Hz
- 옥타브: -8.0 Hz
- 토닉: +3.0 Hz

가중치:
- 5도: 20.0 × 2 = 40.0 ← Primary
- 옥타브: 8.0 × 3 = 24.0
- 토닉: 3.0 × 6 = 18.0

부호 검증:
- Primary(5도): 음수
- 옥타브: 음수 ← 부호 같음
- 토닉: 양수 ← 부호 다름

결과:
✅ Primary: 5도
✅ Auxiliary: 옥타브 (부호 같은 토닉/옥타브 중 가중치 높은 것)
✅ Display: "5도 (+옥타브)"
```

---

## 벡터 계산과의 일관성

개선된 로직은 기존 벡터 계산 로직과 완벽히 일치합니다:

```typescript
// ToneField.tsx Lines 697-711
if (primary.type === 'octave') {
  vectorY = forceOctave;  // 상반구 (양수)
} else {
  vectorY = -forceTonic;  // 하반구 (음수)
}
```

- **토닉과 옥타브는 같은 Y축을 공유하지만 방향이 반대**
- Primary가 토닉/옥타브일 때 vectorY는 **Primary만의 방향**으로만 설정
- 따라서 **서로 보조가 될 수 없음**

---

## 결론

✅ **문제 해결**: 토닉과 옥타브가 동시에 조율대상이 되는 문제 수정  
✅ **좌표계 일관성**: 사분면 개념에 맞는 로직으로 개선  
✅ **벡터 계산 일치**: 기존 타점 계산 로직과 완벽히 일치  
✅ **코드 일관성**: tonefield-calculation.ts와 ToneField.tsx 모두 수정

이제 토닉과 옥타브는 절대로 서로 보조가 될 수 없으며, 좌표계 사분면 개념에 부합하는 올바른 보조 조율대상이 선정됩니다.
