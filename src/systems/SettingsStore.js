// localStorage wrapper for settings. Keys prefixed 'settings.' so all
// future additions share one namespace. No run saves (AGENT.md).
const PREFIX = 'settings.';

const DEFAULTS = {
  // 'joystick' — floating stick, bottom-left quadrant only
  // 'buttons'  — fixed left/right circles at bottom-left
  movementMode: 'joystick',

  // 'aimAndShoot' — right-half drag stick, fires while held (mode 1)
  // 'aimStick'    — right-half drag stick aims, fire button fires (mode 2)
  // 'tapToShoot'  — aim at finger (crosshair follows finger); fire behavior
  //                 is chosen by dragFireMode (mode 3, historical name)
  aimMode: 'aimAndShoot',

  // Fire behavior for aim mode 3 ('tapToShoot').
  // 'onRelease'  — fire one shot on finger release
  // 'continuous' — fire while finger is down (and aim is valid)
  dragFireMode: 'onRelease'
};

export function loadSetting(name) {
  const raw = localStorage.getItem(PREFIX + name);
  if (raw === null) return DEFAULTS[name];
  return raw;
}

export function saveSetting(name, value) {
  localStorage.setItem(PREFIX + name, String(value));
}

export { DEFAULTS as SETTINGS_DEFAULTS };
