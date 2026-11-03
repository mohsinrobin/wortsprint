import { useStore } from '../store/useStore';
import { translate, type StringKey } from '../i18n/strings';

export function useT() {
  const lang = useStore((s) => s.settings.uiLang);
  return (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
