# 문제 해결 가이드

## Error Code: -102 (연결 거부)

이 에러는 브라우저가 서버에 연결할 수 없을 때 발생합니다.

### 원인
1. 개발 서버가 실행되지 않음
2. 잘못된 포트 번호 사용
3. 다른 프로세스가 포트를 사용 중

### 해결 방법

#### 1. 개발 서버 실행 확인

터미널에서 다음 명령어로 서버를 실행하세요:

```bash
cd frontend
npm run dev
```

서버가 정상적으로 실행되면 다음과 같은 메시지가 표시됩니다:
```
  ▲ Next.js 16.0.3
  - Local:        http://localhost:3003
  - Ready in X.Xs
```

#### 2. 포트 확인

- 기본 포트: `3003` (package.json에서 설정됨)
- 다른 포트 사용: `npm run dev:3004` (3004 포트 사용)
- 포트 변경: `next dev -p [원하는포트]`

#### 3. 포트 충돌 해결

포트가 이미 사용 중인 경우:

```bash
# macOS/Linux에서 포트 사용 중인 프로세스 확인
lsof -i :3003

# 프로세스 종료
kill -9 [PID]

# 또는 다른 포트 사용
npm run dev:3004
```

#### 4. 올바른 URL 확인

- 메인 페이지: `http://localhost:3003/`
- 임베드 페이지: `http://localhost:3003/embed`
- 포트 3004 사용 시: `http://localhost:3004/embed`

#### 5. 브라우저 캐시 클리어

브라우저 캐시 문제일 수 있습니다:
- Chrome: Cmd+Shift+Delete (Mac) 또는 Ctrl+Shift+Delete (Windows)
- 또는 시크릿 모드에서 테스트

#### 6. 방화벽 확인

로컬호스트이므로 일반적으로 문제가 없지만, 방화벽 설정을 확인하세요.

---

## 다른 일반적인 문제

### iframe이 로드되지 않음

**원인**: X-Frame-Options 헤더 문제

**해결**: `next.config.ts`에서 이미 설정되어 있습니다. 서버를 재시작하세요:
```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
npm run dev
```

### CORS 에러

**원인**: 다른 도메인에서 접근 시도

**해결**: 로컬에서는 문제 없습니다. 외부 도메인 사용 시 `next.config.ts`에 CORS 설정 추가 필요합니다.

### 페이지가 빈 화면으로 표시됨

**원인**: JavaScript 에러 또는 빌드 문제

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 개발 서버 재시작
npm run dev
```

---

## 빠른 체크리스트

- [ ] 개발 서버가 실행 중인가요? (`npm run dev`)
- [ ] 올바른 포트를 사용하고 있나요? (기본: 3003)
- [ ] 브라우저에서 `http://localhost:3003`에 직접 접속해보세요
- [ ] 터미널에 에러 메시지가 있나요?
- [ ] 다른 프로세스가 포트를 사용 중인가요?

---

## 도움말

문제가 계속되면:
1. 터미널의 전체 에러 메시지를 확인하세요
2. 브라우저 개발자 도구(F12)의 Console 탭 확인
3. Network 탭에서 실패한 요청 확인

