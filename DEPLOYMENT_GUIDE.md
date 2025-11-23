# 배포 가이드 - Vercel

## Vercel 배포 (권장)

Vercel은 Next.js에 최적화된 배포 플랫폼입니다. 무료 플랜으로도 충분히 사용 가능합니다.

### 방법 1: Vercel CLI 사용

#### 1. Vercel CLI 설치
```bash
npm i -g vercel
```

#### 2. 로그인
```bash
vercel login
```

#### 3. 배포
```bash
cd frontend
vercel
```

첫 배포 시 질문에 답변:
- Set up and deploy? **Y**
- Which scope? (자신의 계정 선택)
- Link to existing project? **N**
- Project name? (원하는 이름 또는 Enter로 기본값)
- Directory? **./** (Enter)
- Override settings? **N**

#### 4. 프로덕션 배포
```bash
vercel --prod
```

배포가 완료되면 다음과 같은 URL이 제공됩니다:
```
https://your-project-name.vercel.app
```

### 방법 2: GitHub 연동 (자동 배포)

#### 1. GitHub에 프로젝트 푸시
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

#### 2. Vercel 웹사이트에서 연동
1. [vercel.com](https://vercel.com) 접속
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (자동 감지됨)
   - **Output Directory**: `.next` (자동 감지됨)
5. "Deploy" 클릭

#### 3. 환경 변수 설정 (필요시)
Vercel 대시보드 → Project Settings → Environment Variables에서:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 배포 후 사용 방법

배포가 완료되면 공개 URL을 얻을 수 있습니다:

```html
<!-- 예시: https://your-project.vercel.app -->
<iframe 
  src="https://your-project.vercel.app/embed" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

### URL 파라미터 사용

```html
<iframe 
  src="https://your-project.vercel.app/embed?tension=0.7&wireframe=true&cameraView=perspective" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

---

## 다른 배포 옵션

### Netlify

```bash
# Netlify CLI 설치
npm i -g netlify-cli

# 배포
cd frontend
netlify deploy --prod
```

### Railway

1. [railway.app](https://railway.app) 접속
2. "New Project" → "Deploy from GitHub"
3. 저장소 선택 및 배포

### 자체 서버 (VPS)

```bash
# 프로덕션 빌드
cd frontend
npm run build

# 서버 시작
npm start
```

---

## 배포 전 체크리스트

- [ ] 환경 변수 설정 확인 (Supabase 등)
- [ ] `next.config.ts` 설정 확인
- [ ] 빌드 에러 없음 확인 (`npm run build`)
- [ ] `/embed` 경로 테스트
- [ ] iframe 헤더 설정 확인

---

## 배포 후 확인 사항

1. **메인 페이지 접속**: `https://your-project.vercel.app`
2. **임베드 페이지 접속**: `https://your-project.vercel.app/embed`
3. **iframe 테스트**: 다른 웹페이지에서 iframe으로 임베드 테스트
4. **CORS 설정**: 필요시 추가 설정

---

## 커스텀 도메인 설정 (선택사항)

Vercel 대시보드에서:
1. Project Settings → Domains
2. 원하는 도메인 추가
3. DNS 설정 안내에 따라 도메인 설정

---

## 자동 배포 설정

GitHub 연동 시:
- `main` 브랜치에 푸시하면 자동 배포
- Pull Request마다 프리뷰 배포 생성

---

## 비용

- **Vercel 무료 플랜**: 
  - 월 100GB 대역폭
  - 무제한 요청
  - 개인 프로젝트에 충분

- **프로 플랜**: 
  - 더 많은 대역폭
  - 팀 협업 기능
  - 우선 지원

