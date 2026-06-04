export function openNearestDrawer(navigation) {
  let current = navigation;

  while (current) {
    if (typeof current.openDrawer === 'function') {
      current.openDrawer();
      return true;
    }

    current = typeof current.getParent === 'function' ? current.getParent() : null;
  }

  return false;
}
