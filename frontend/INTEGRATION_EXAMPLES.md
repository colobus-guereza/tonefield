# 통합 예제 가이드

## 방법 1: React 컴포넌트로 사용

### 설치
```bash
# 프로젝트에 의존성 설치
npm install @react-three/fiber @react-three/drei three
```

### 사용 예시
```tsx
import { ToneField3D } from '@/components/ToneField3D';

function MyApp() {
  const [tension, setTension] = useState(0.5);
  const [hitPoint, setHitPoint] = useState({
    location: null as "internal" | "external" | null,
    coordinate: "",
    strength: "",
    count: "",
    hammeringType: ""
  });

  return (
    <div style={{ width: '800px', height: '600px' }}>
      <ToneField3D
        tension={tension}
        wireframe={true}
        cameraView="top"
        hitPointLocation={hitPoint.location}
        hitPointCoordinate={hitPoint.coordinate}
        hitPointStrength={hitPoint.strength}
        hitPointCount={hitPoint.count}
        hammeringType={hitPoint.hammeringType}
        onTensionChange={(newTension) => {
          setTension(newTension);
          console.log('Tension changed:', newTension);
        }}
        onCameraViewChange={(view) => {
          console.log('Camera view changed:', view);
        }}
      />
    </div>
  );
}
```

---

## 방법 2: iframe으로 임베드

### 기본 사용
```html
<iframe 
  src="http://localhost:3003/embed" 
  width="100%" 
  height="600px"
  frameborder="0"
  allowfullscreen>
</iframe>
```

### URL 파라미터로 설정
```html
<iframe 
  src="http://localhost:3003/embed?tension=0.7&wireframe=true&cameraView=perspective" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

### 지원하는 URL 파라미터
- `tension`: 0.0 ~ 1.0 (기본값: 0.5)
- `wireframe`: true/false (기본값: true)
- `cameraView`: perspective/top (기본값: top)
- `hitPointLocation`: internal/external
- `hitPointCoordinate`: "(x, y)" 형식
- `hitPointStrength`: 강도 값
- `hitPointCount`: 타수 값
- `hammeringType`: 해머링 타입

### 예시: 타점이 있는 상태로 표시
```html
<iframe 
  src="http://localhost:3003/embed?hitPointLocation=internal&hitPointCoordinate=(0.2,-0.3)&hitPointStrength=25.5&hitPointCount=2&hammeringType=튕겨치기" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

---

## 방법 3: JavaScript로 동적 제어

### iframe과 postMessage 통신
```html
<!DOCTYPE html>
<html>
<head>
  <title>ToneField Integration</title>
</head>
<body>
  <iframe 
    id="tonefield-iframe"
    src="http://localhost:3003/embed" 
    width="100%" 
    height="600px"
    frameborder="0">
  </iframe>

  <script>
    const iframe = document.getElementById('tonefield-iframe');
    
    // iframe 로드 완료 후 설정
    iframe.onload = () => {
      // URL 파라미터 업데이트
      const params = new URLSearchParams({
        tension: '0.7',
        wireframe: 'true',
        cameraView: 'top'
      });
      iframe.src = `http://localhost:3003/embed?${params.toString()}`;
    };

    // 타점 업데이트 함수
    function updateHitPoint(data) {
      const params = new URLSearchParams({
        tension: '0.5',
        hitPointLocation: data.location || '',
        hitPointCoordinate: data.coordinate || '',
        hitPointStrength: data.strength || '',
        hitPointCount: data.count || '',
        hammeringType: data.hammeringType || ''
      });
      iframe.src = `http://localhost:3003/embed?${params.toString()}`;
    }

    // 사용 예시
    updateHitPoint({
      location: 'internal',
      coordinate: '(0.2, -0.3)',
      strength: '25.5',
      count: '2',
      hammeringType: '튕겨치기'
    });
  </script>
</body>
</html>
```

---

## 방법 4: Vue.js에서 사용

```vue
<template>
  <div style="width: 800px; height: 600px;">
    <iframe 
      :src="iframeUrl" 
      width="100%" 
      height="100%"
      frameborder="0">
    </iframe>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const tension = ref(0.5);
const hitPointLocation = ref(null);

const iframeUrl = computed(() => {
  const params = new URLSearchParams({
    tension: tension.value.toString(),
    wireframe: 'true',
    cameraView: 'top',
    ...(hitPointLocation.value && { hitPointLocation: hitPointLocation.value })
  });
  return `http://localhost:3003/embed?${params.toString()}`;
});
</script>
```

---

## 방법 5: Angular에서 사용

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-tonefield',
  template: `
    <div style="width: 800px; height: 600px;">
      <iframe 
        [src]="iframeUrl" 
        width="100%" 
        height="100%"
        frameborder="0">
      </iframe>
    </div>
  `
})
export class ToneFieldComponent {
  tension = 0.5;
  hitPointLocation: 'internal' | 'external' | null = null;

  get iframeUrl(): string {
    const params = new URLSearchParams({
      tension: this.tension.toString(),
      wireframe: 'true',
      cameraView: 'top',
      ...(this.hitPointLocation && { hitPointLocation: this.hitPointLocation })
    });
    return `http://localhost:3003/embed?${params.toString()}`;
  }
}
```

---

## 방법 6: WordPress에 임베드

### 방법 A: HTML 블록 사용
```
[html]
<iframe 
  src="http://localhost:3003/embed?tension=0.5" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
[/html]
```

### 방법 B: Shortcode 생성
```php
function tonefield_shortcode($atts) {
    $tension = $atts['tension'] ?? '0.5';
    return '<iframe src="http://localhost:3003/embed?tension=' . esc_attr($tension) . '" width="100%" height="600px" frameborder="0"></iframe>';
}
add_shortcode('tonefield', 'tonefield_shortcode');
```

사용: `[tonefield tension="0.7"]`

---

## 보안 고려사항

1. **CORS 설정**: 다른 도메인에서 사용하려면 CORS 헤더 설정 필요
2. **X-Frame-Options**: iframe 임베드를 허용하려면 헤더 제거 또는 조정 필요
3. **Content Security Policy**: CSP 설정에서 iframe 소스 허용 필요

### Next.js 설정 예시
```typescript
// next.config.ts
export default {
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          }
        ]
      }
    ];
  }
};
```

