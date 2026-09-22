/**
 * `dict_entries` view의 SQL 정의:
 *
 *   SELECT e.id, e.headword, e.headword_normalized, e.definition_html,
 *          e.definition_text, e.dictionary_id, d.name AS dictionary_name,
 *          d.marker, d.lang_from, d.lang_to
 *   FROM entries e JOIN dictionaries d ON d.id = e.dictionary_id
 *
 * `dict_inflections` view의 SQL 정의:
 *
 *   SELECT rowid AS id, inflected_normalized, headword_normalized
 *   FROM inflections
 */

/** `dict_entries` view의 레코드 (표제어/정의 + 소속 사전 정보). */
export interface DictEntry {
  id: string;
  headword: string;
  headword_normalized: string;
  definition_html: string;
  definition_text: string;
  /** SQLite INTEGER 컬럼이라 JSON에서는 number로 옵니다 (설정값 비교 시 String() 변환 필요). */
  dictionary_id: string | number;
  dictionary_name: string;
  marker: string;
  lang_from: string;
  lang_to: string;
}

/** `dict_inflections` view의 레코드 (활용형 -> 표제어 정규화 매핑). */
export interface DictInflection {
  id: string;
  inflected_normalized: string;
  headword_normalized: string;
}

/** 한 단어 조회 결과. */
export interface DictionaryLookupResult {
  query: string;
  entries: DictEntry[];
  inflections: DictInflection[];
  fetchedAt: number;
}

/** PocketBase 인증 응답 (auth-with-password). */
export interface PocketBaseAuthResponse {
  token: string;
  record: Record<string, unknown>;
}

/** PocketBase 목록 조회 응답. */
export interface PocketBaseListResponse<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}
