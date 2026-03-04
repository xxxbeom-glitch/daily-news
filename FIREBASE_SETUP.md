# Firebase 설정 가이드

설정·관리자·시황 요약 데이터를 Firestore에 저장하여 브라우저 초기화 후에도 복구할 수 있습니다.

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 추가
3. **Authentication** → 로그인 방법 → **익명** 활성화
4. **Firestore Database** → 데이터베이스 만들기 (테스트 모드로 시작 후 규칙 수정)

## 2. Firestore 규칙

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 3. .env 설정

Firebase Console → 프로젝트 설정 → 일반 → 앱(웹) → SDK snippet에서 확인:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=1:123:web:abc
```

## 4. 저장 구조

- `users/{uid}/data/settings` - 선택 소스, 관심사, 모델
- `users/{uid}/data/admin` - 관리자 설정
- `users/{uid}/data/meta` - 아카이브/검색 UI 상태
- `users/{uid}/sessions/{sessionId}` - 시황 요약 세션 (날짜별)

.env에 위 3개 변수가 없으면 Firebase 없이 기존처럼 localStorage만 사용됩니다.
