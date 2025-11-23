# 3D 톤필드 좌표계 통합 가이드

## 빠른 시작

### 방법 1: iframe 임베드 (가장 간단)

```html
<iframe 
  src="http://localhost:3003/embed" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

### 방법 2: React 컴포넌트로 사용

```tsx
import { ToneField3D } from '@/components/ToneField3D';

<ToneField3D
  tension={0.5}
  wireframe={true}
  cameraView="top"
/>
```

## 상세 가이드

- [재사용성 가이드](./REUSABILITY_GUIDE.md) - 다양한 통합 방법 설명
- [통합 예제](./INTEGRATION_EXAMPLES.md) - 실제 코드 예제

## 개발 서버 실행

```bash
cd frontend
npm run dev
```

그 다음 `http://localhost:3003/embed`로 접속하여 iframe 임베드 페이지를 확인하세요.

