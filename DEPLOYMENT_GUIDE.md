# 🚀 KTAS AI 배포 가이드

## Step 1: GitHub Desktop으로 코드 올리기

1. **GitHub Desktop 열기**
   - `C:\Users\kyehong.kim\AppData\Local\GitHubDesktop\GitHubDesktop.exe` 실행

2. **GitHub 로그인**
   - "Sign in to GitHub" → `esh3119-cloud` 계정으로 로그인

3. **저장소 추가**
   - `File` → `Add Local Repository`
   - 폴더: `C:\Users\kyehong.kim\Desktop\ktas-ai-new` 선택
   - "Add Repository" 클릭

4. **저장소 게시(Publish)**
   - "Publish repository" 클릭
   - 이름: `ktas-ai` (또는 원하는 이름)
   - "Publish Repository" 클릭

---

## Step 2: Render.com 백엔드 배포

1. **Render.com 로그인**
   - https://render.com 접속 → 로그인

2. **GitHub 연결**
   - "New +" → "Web Service"
   - GitHub 계정 연결 → `ktas-ai` 저장소 선택

3. **배포 설정**
   - **Name**: `ktas-ai-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/health`

4. **환경 변수 설정**
   - `NODE_ENV` = `production`
   - `PORT` = `5000`

5. **배포 완료**
   - "Create Web Service" 클릭
   - 배포 완료 후 URL 획득 (예: `https://ktas-ai-backend.onrender.com`)

---

## Step 3: Netlify 프론트엔드 배포

1. **빌드 파일 준비**
   - 이미 `npm run build` 완료 → `build/` 폴더 생성됨

2. **Netlify 로그인**
   - https://netlify.com 접속 → 로그인

3. **GitHub 연결 배포**
   - "Add new site" → "Import an existing project"
   - GitHub 연결 → `ktas-ai` 저장소 선택

4. **배포 설정**
   - **Build Command**: `npm run build`
   - **Publish Directory**: `build`

5. **환경 변수 설정**
   - `REACT_APP_BACKEND_URL` = `https://ktas-ai-backend.onrender.com` (Render URL)
   - `REACT_APP_CLAUDE_API_KEY` = (API 키 입력)
   - `REACT_APP_SPEECH_API_KEY` = (API 키 입력)

6. **배포 완료**
   - "Deploy site" 클릭
   - 배포 완료 후 URL 획득 (예: `https://ktas-ai.netlify.app`)

---

## Step 4: 로컬 테스트 (선택사항)

### 프론트엔드 실행
```bash
cd C:\Users\kyehong.kim\Desktop\ktas-ai-new
npm start
```
→ http://localhost:3000 에서 확인

### 백엔드 실행
```bash
cd C:\Users\kyehong.kim\Desktop\ktas-ai-new
npm run start:server
```
→ http://localhost:5000 에서 확인

### 동시 실행 (개발 모드)
```bash
cd C:\Users\kyehong.kim\Desktop\ktas-ai-new
npm run dev
```

---

## 📁 배포 관련 파일 목록

| 파일 | 용도 |
|------|------|
| `render.yaml` | Render.com 백엔드 배포 설정 |
| `netlify.toml` | Netlify 프론트엔드 배포 설정 |
| `Procfile` | 백엔드 시작 명령 |
| `.env.example` | 환경 변수 예제 |
| `package.json` | Node.js 프로젝트 설정 (engines 포함) |

---

## ✅ 배포 체크리스트

- [x] Git 저장소 초기화 및 커밋
- [x] 프론트엔드 빌드 성공 (`npm run build`)
- [x] 백엔드 서버 정상 실행 확인 (health check 응답)
- [x] 배포 설정 파일 생성 (render.yaml, netlify.toml, Procfile)
- [x] 환경 변수 처리 (REACT_APP_BACKEND_URL)
- [ ] GitHub Desktop으로 저장소 Publish
- [ ] Render.com 백엔드 배포
- [ ] Netlify 프론트엔드 배포
- [ ] 환경 변수 설정 (API 키 등)
