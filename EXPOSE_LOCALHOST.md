# 로컬호스트를 외부에서 접근 가능하게 만들기

## 방법 1: ngrok 사용 (가장 간단)

### 설치
```bash
# macOS
brew install ngrok

# 또는 공식 사이트에서 다운로드
# https://ngrok.com/download
```

### 사용 방법
```bash
# 1. 개발 서버 실행 (다른 터미널)
cd frontend
npm run dev

# 2. ngrok으로 터널 생성 (새 터미널)
ngrok http 3003
```

ngrok이 다음과 같은 공개 URL을 제공합니다:
```
Forwarding  https://xxxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3003
```

이제 이 URL을 iframe 테스터나 다른 웹사이트에서 사용할 수 있습니다:
```html
<iframe src="https://xxxx-xxx-xxx-xxx.ngrok-free.app/embed"></iframe>
```

---

## 방법 2: Cloudflare Tunnel (무료, 영구)

### 설치
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared
```

### 사용 방법
```bash
# 터널 생성
cloudflared tunnel --url http://localhost:3003
```

---

## 방법 3: localtunnel (npm 패키지)

### 설치 및 사용
```bash
npm install -g localtunnel

# 터널 생성
lt --port 3003
```

---

## 방법 4: VS Code Port Forwarding

VS Code를 사용하는 경우:
1. 포트 3003을 우클릭
2. "Port Visibility" → "Public" 선택
3. 공개 URL이 생성됨

---

## 방법 5: 실제 배포 (프로덕션)

### Vercel 배포 (Next.js에 최적화)
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
cd frontend
vercel
```

### Netlify 배포
```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 배포
cd frontend
netlify deploy --prod
```

---

## 보안 주의사항

⚠️ **중요**: 로컬호스트를 공개 URL로 노출할 때는:
- 개발 중인 코드가 노출될 수 있습니다
- 프로덕션 데이터베이스나 민감한 정보에 접근하지 않도록 주의하세요
- 테스트용으로만 사용하고, 사용 후 터널을 종료하세요

