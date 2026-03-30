export function openOverlay() {
  const url = `${window.location.origin}/duel-tools/record/overlay`;
  window.open(url, 'overlay', 'width=520,height=130,resizable=yes');
}
