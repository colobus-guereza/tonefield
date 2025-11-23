# 3D 좌표계 재사용 가이드

이 문서는 개발한 3D 톤필드 좌표계를 다른 웹페이지나 프론트엔드 플랫폼에서 사용하는 방법을 설명합니다.

## 방법 1: npm 패키지로 배포 (권장)

### 장점
- 다른 React 프로젝트에서 바로 import하여 사용 가능
- 타입스크립트 지원
- 버전 관리 용이
- 트리 쉐이킹으로 번들 크기 최적화

### 구현 방법
1. 독립적인 컴포넌트 라이브러리 생성
2. npm에 배포
3. 다른 프로젝트에서 `npm install @your-org/tonefield-3d`로 설치

### 사용 예시
```tsx
import { ToneField3D } from '@your-org/tonefield-3d';

function App() {
  return (
    <ToneField3D
      tension={0.5}
      onHitPointChange={(data) => console.log(data)}
    />
  );
}
```

---

## 방법 2: iframe 임베드

### 장점
- 가장 간단한 통합 방법
- React를 사용하지 않는 웹페이지에서도 사용 가능
- 완전히 독립적인 환경에서 실행

### 구현 방법
1. 독립적인 페이지 생성 (`/embed` 경로)
2. iframe으로 임베드

### 사용 예시
```html
<iframe 
  src="https://your-domain.com/embed" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

---

## 방법 3: Web Component로 변환

### 장점
- React 없이도 사용 가능
- 모든 프레임워크와 호환 (Vue, Angular, Vanilla JS 등)
- 표준 웹 기술 사용

### 사용 예시
```html
<tonefield-3d 
  tension="0.5"
  wireframe="true">
</tonefield-3d>
```

---

## 방법 4: CDN을 통한 스크립트 로드

### 장점
- 설치 없이 바로 사용 가능
- 빠른 프로토타이핑

### 사용 예시
```html
<script src="https://cdn.your-domain.com/tonefield-3d.js"></script>
<script>
  ToneField3D.render('#container', {
    tension: 0.5,
    wireframe: true
  });
</script>
```

---

## 방법 5: API + 프론트엔드 분리

### 장점
- 백엔드 로직과 프론트엔드 분리
- 다양한 클라이언트에서 동일한 API 사용 가능

### 구조
- API: 타점 계산, 데이터 저장 등
- 프론트엔드: 3D 시각화만 담당

---

## 추천 구현 순서

1. **단기**: iframe 임베드 페이지 생성 (가장 빠름)
2. **중기**: 독립적인 React 컴포넌트 라이브러리 생성
3. **장기**: npm 패키지로 배포

