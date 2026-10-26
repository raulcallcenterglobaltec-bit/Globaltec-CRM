// Desplazar solo durante el arrastre nativo de una tarjeta del tablero.
(() => {
  let board = null, pointerX = 0, frame = 0, lastTime = 0;
  const selector = '.lead-board,.opportunity-board';
  function stopFrame() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function velocity() {
    if (!board?.isConnected) return 0;
    const rect = board.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    const edge = Math.min(80, (right - left) / 4);
    if (edge <= 0 || pointerX < left || pointerX > right) return 0;
    if (pointerX < left + edge) return -Math.ceil(700 * (left + edge - pointerX) / edge);
    if (pointerX > right - edge) return Math.ceil(700 * (pointerX - right + edge) / edge);
    return 0;
  }
  function tick(time) {
    frame = 0;
    const speed = velocity();
    if (!speed) {lastTime = 0;return;}
    const elapsed = lastTime ? Math.min(40, time - lastTime) : 16;
    lastTime = time;
    const before = board.scrollLeft;
    board.scrollLeft = Math.max(0, Math.min(board.scrollWidth - board.clientWidth, before + speed * elapsed / 1000));
    if (Math.abs(board.scrollLeft - before) < .1) {lastTime = 0;return;}
    frame = requestAnimationFrame(tick);
  }
  function finish() {stopFrame();board = null;}
  document.addEventListener('dragstart', event => {
    finish();
    const card = event.target.closest('.lead-card,.opportunity-board-card');
    if (card?.draggable && !event.defaultPrevented) board = card.closest(selector);
  });
  document.addEventListener('dragover', event => {
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom || !board.contains(event.target)) {stopFrame();return;}
    pointerX = event.clientX;
    if (!velocity()) stopFrame();
    else if (!frame) frame = requestAnimationFrame(tick);
  });
  document.addEventListener('dragleave', event => {
    if (board && !board.contains(event.relatedTarget)) stopFrame();
  });
  document.addEventListener('drop', finish, true);
  document.addEventListener('dragend', finish, true);
  window.addEventListener('blur', finish);
})();
