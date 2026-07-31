const KEY = 'sb_captions'

export const CAPTION_DEFAULTS = {
  enabled: true, // show captions by default when available
  size: 100, // font size %  (50–200)
  position: 10, // distance from the bottom, % of height (2–40)
  color: '#ffffff',
  bg: 60, // background opacity %  (0–100)
}

export function getCaptionSettings() {
  try {
    return { ...CAPTION_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...CAPTION_DEFAULTS }
  }
}

export function setCaptionSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s))
  window.dispatchEvent(new Event('captions:changed'))
}
