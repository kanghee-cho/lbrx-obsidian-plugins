# 아키텍처: LBRX Obsidian Plugins 모노레포

이 저장소는 여러 개의 독립적인 Obsidian 플러그인을 하나의 pnpm workspace 모노레포에서
개발하기 위한 구조입니다. 목표는 다음 두 가지를 동시에 만족시키는 것입니다.

1. **공유 가능성**: 플러그인 간 공통 코드(타입, 유틸, UI 컴포넌트)와 공통 데이터를
   중복 없이 재사용한다.
2. **독립 설치 가능성**: 각 플러그인은 사용자가 `manifest.json` + `main.js` (+
   `styles.css`) 3개 파일만으로 설치·동작할 수 있는 완전히 독립된 산출물이어야 한다.

---

## 1. 폴더 구조

```
lbrx-obsidian-plugins/
├── package.json                # workspace 루트, 공통 devDependencies/scripts
├── pnpm-workspace.yaml          # packages/*, plugins/* 를 workspace로 등록
├── tsconfig.base.json           # 모든 패키지가 extends 하는 공통 컴파일러 옵션
├── .eslintrc.cjs                # 공통 lint 규칙
├── esbuild.base.mjs             # 모든 플러그인이 재사용하는 esbuild 빌드 팩토리
├── .gitignore
│
├── packages/                    # 플러그인끼리 공유하는 내부 전용 패키지 (npm 미배포)
│   ├── shared-core/             # 공통 타입, 상수, 순수 유틸
│   ├── shared-ui/               # 공통 Obsidian UI 컴포넌트 (Modal 등)
│   └── shared-settings/         # 플러그인 간 런타임 데이터 공유 헬퍼
│
├── plugins/                     # 실제 배포되는 Obsidian 플러그인 (독립 설치 단위)
│   └── sample-plugin/           # 템플릿 역할을 하는 예시 플러그인
│       ├── manifest.json
│       ├── versions.json
│       ├── styles.css
│       ├── esbuild.config.mjs
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── settings.ts
│           └── SampleSettingTab.ts
│
├── scripts/
│   ├── release.mjs              # manifest/versions/package.json 버전 동기화
│   └── copy-to-vault.mjs        # 빌드 산출물을 로컬 vault에 복사 (개발용)
│
└── docs/
    └── ARCHITECTURE.md          # 이 문서
```

새 플러그인을 추가할 때는 `plugins/sample-plugin`을 복사해 이름/ID만 바꾸면 됩니다.

---

## 2. 왜 pnpm workspace인가

- `pnpm-workspace.yaml`에 `packages/*`와 `plugins/*`를 등록하면, 각 패키지의
  `package.json`에서 `"@lbrx/shared-core": "workspace:*"`처럼 참조할 수 있습니다.
- workspace 참조는 심볼릭 링크로 연결되므로 `packages/shared-core`를 수정하면
  모든 플러그인에서 즉시(재빌드 시) 반영됩니다. 별도의 `npm publish` 과정이
  필요 없습니다.
- `packages/*`의 `package.json`은 모두 `"private": true`이며 npm registry에
  게시되지 않습니다. 오직 워크스페이스 내부에서만 사용되는 컴파일 타임
  의존성입니다.

---

## 3. 독립 설치가 가능한 이유 (빌드 전략)

각 플러그인의 `esbuild.config.mjs`는 루트의 `esbuild.base.mjs`가 제공하는
`buildPlugin()`을 호출합니다. 이 빌드는:

- `entryPoints: [src/main.ts]` 하나만 지정하고 `bundle: true`로 설정합니다.
- `@lbrx/shared-core`, `@lbrx/shared-ui`, `@lbrx/shared-settings` 등 workspace
  의존성은 **번들러가 소스 코드를 그대로 inline** 합니다. (npm 패키지가 아니라
  로컬 TS 소스이기 때문에 esbuild 입장에서는 그냥 일반 소스 파일입니다.)
- `external`에는 Obsidian 런타임이 이미 제공하는 모듈만 나열합니다
  (`obsidian`, `electron`, CodeMirror/Lezer 계열, Node builtin). 즉 shared
  패키지는 external 처리되지 않고 번들 안에 포함됩니다.

결과적으로 `plugins/sample-plugin/main.js` 하나에는 `shared-core`,
`shared-ui`, `shared-settings`의 코드가 전부 인라인되어 있고, 이 파일과
`manifest.json`, `styles.css`만 있으면 다른 플러그인이나 워크스페이스 없이도
독립적으로 설치·동작합니다.

```bash
pnpm --filter @lbrx/sample-plugin build
# -> plugins/sample-plugin/main.js 생성 (완전한 단일 번들)
```

---

## 4. 공유 패키지 역할 분담

| 패키지 | 용도 | 예시 |
|---|---|---|
| `@lbrx/shared-core` | 순수 TS 타입/상수/유틸. Obsidian API에 의존하지 않음 | `mergeSettings()`, `debounce()`, `PLUGIN_IDS` |
| `@lbrx/shared-ui` | Obsidian `Modal`/`Setting` 등을 감싼 재사용 UI | `ConfirmModal` |
| `@lbrx/shared-settings` | 플러그인 간 런타임 데이터 교환 (파일 기반) | `readSharedData()`, `writeSharedData()` |

새로운 공통 로직이 필요하면 성격에 맞는 패키지에 추가하고, 플러그인
`package.json`에 `"@lbrx/xxx": "workspace:*"`로 의존성을 추가합니다.

---

## 5. 플러그인 간 데이터 공유 전략

두 가지 계층으로 나눠서 생각합니다.

### 5.1 컴파일 타임 공유 (코드/타입/상수)
- `packages/shared-core`의 타입/상수를 import해서 사용합니다.
- 빌드 시 각 플러그인 번들에 inline되므로 런타임 의존성은 남지 않습니다.

### 5.2 런타임 데이터 공유 (실제 값 교환)
- 플러그인들은 서로를 하드 의존하지 않아야 개별 설치가 가능합니다. 따라서
  직접 `import`로 연결하는 대신, `.obsidian/lbrx-shared.json`이라는 공용
  데이터 파일을 통해 **느슨하게(loosely-coupled)** 값을 주고받습니다.
- `@lbrx/shared-settings`가 이 파일의 read/write를 감싸며, 각 플러그인은
  자신의 `pluginId` 네임스페이스 아래에만 값을 씁니다.

```json
{
  "version": 1,
  "lbrx-sample-plugin": { "lastGreetingAt": 1732000000000 },
  "lbrx-other-plugin": { "sharedTag": "project-x" }
}
```

- 다른 플러그인의 설정을 직접 참조해야 한다면
  `app.plugins.plugins["<other-plugin-id>"]`로 optional 접근하고, 해당
  플러그인이 설치되어 있지 않을 수 있음을 항상 방어 코드로 처리합니다.

---

## 6. 개발/빌드 워크플로우

```bash
# 최초 설치
pnpm install

# 특정 플러그인만 watch 모드로 개발
pnpm --filter @lbrx/sample-plugin dev

# 모든 플러그인 production 빌드
pnpm build

# 빌드 산출물을 로컬 vault에 복사해 테스트
node scripts/copy-to-vault.mjs sample-plugin ~/ObsidianVaults/test-vault

# 플러그인 버전 올리기 (manifest/versions/package.json 동기화)
node scripts/release.mjs sample-plugin 0.2.0
```

---

## 7. 새 플러그인 추가 체크리스트

1. `plugins/sample-plugin`을 복사해 `plugins/<new-plugin>`으로 이름 변경
2. `manifest.json`의 `id`, `name`, `description`, `author` 수정
3. `package.json`의 `name`을 `@lbrx/<new-plugin>`으로 변경
4. 필요한 `@lbrx/shared-*` 패키지를 dependencies에 추가
5. `pnpm install` 재실행 (workspace 링크 생성)
6. `pnpm --filter @lbrx/<new-plugin> dev`로 개발 시작

---

## 8. 왜 이렇게 나눴는가 (설계 근거 요약)

- **`packages/` vs `plugins/`**: `packages`는 "번들에 흡수되는 라이브러리
  코드", `plugins`는 "사용자에게 배포되는 최종 산출물"이라는 역할 차이를
  폴더로 명확히 구분합니다.
- **버전 독립성**: `packages/*`는 `private`이고 semver를 신경 쓸 필요가
  없는 반면, `plugins/*`는 각자 `manifest.json`/`versions.json`으로 독립
  릴리즈 주기를 가집니다.
- **공유는 하되 결합은 하지 않는다**: 컴파일 타임 공유(shared-core 등)는
  자유롭게 하되, 런타임 상호작용(shared-settings)은 파일 기반의 느슨한
  연결로 제한해 "플러그인 A가 없으면 플러그인 B가 깨진다"는 상황을 방지합니다.
