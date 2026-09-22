import type { BaseLbrxSettings } from "@lbrx/shared-core";

export interface LbrxDictionarySettings extends BaseLbrxSettings {
  /** PocketBase 인스턴스 기본 URL (마지막 슬래시 없이). */
  pocketbaseUrl: string;
  /** 로그인에 사용할 PocketBase auth collection 이름 (보통 "users"). */
  authCollection: string;
  /** 로그인 identity (이메일 또는 username). */
  identity: string;
  /** 로그인 비밀번호. 주의: data.json에 평문으로 저장됩니다. */
  password: string;

  /** 표제어/정의를 담고 있는 view/collection 이름. */
  entriesCollection: string;
  /** 활용형 -> 표제어 매핑을 담고 있는 view/collection 이름. */
  inflectionsCollection: string;

  /** 조회 결과 캐시 유지 시간(분). */
  cacheTtlMinutes: number;

  /**
   * 노트에서 사전 용어를 감싸는 구분자. 기본값 "::" -> `::단어::`.
   * 여는/닫는 구분자가 동일한 형태만 지원합니다.
   */
  termDelimiter: string;

  /**
   * 동일 단어가 여러 사전(dictionary_id)에 존재할 때 우선적으로 보여줄 사전의
   * dictionary_id 목록 (우선순위 순서). 예: ["2", "5"] -> 2번 사전(LDOCE)의
   * 결과가 있으면 그것만 보여주고, 없으면 5번 사전 결과를 사용합니다.
   * 목록에 있는 모든 사전에 결과가 없으면 찾은 전체 결과를 보여줍니다.
   */
  dictionaryPriority: string[];
}

export const DEFAULT_SETTINGS: LbrxDictionarySettings = {
  settingsVersion: 1,
  pocketbaseUrl: "https://dict.lbrx.net",
  authCollection: "users",
  identity: "",
  password: "",
  entriesCollection: "dict_entries",
  inflectionsCollection: "dict_inflections",
  cacheTtlMinutes: 60,
  termDelimiter: "::",
  dictionaryPriority: [],
};
