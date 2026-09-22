# LBRX Obsidian Plugins

여러 Obsidian 플러그인을 관리하는 pnpm workspace 모노레포입니다.
구조와 설계 근거는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참고하세요.

## Quick Start

```bash
pnpm install
pnpm --filter @lbrx/sample-plugin dev      # watch 모드로 샘플 플러그인 개발
pnpm build                                  # 전체 플러그인 production 빌드
```

## 구조 요약

- `packages/*` — 플러그인 간 공유되는 내부 전용 라이브러리 (npm 미배포, 빌드 시 각 플러그인에 inline)
- `plugins/*` — 실제 배포되는 독립 Obsidian 플러그인 (각각 `manifest.json` + `main.js`만으로 설치 가능)
- `scripts/*` — 릴리즈/로컬 테스트용 스크립트

자세한 내용은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 확인하세요.
