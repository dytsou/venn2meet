const DEFAULT_MIN_TOUCH_SIZE = 44;

function cellFromEvent(container, event) {
  if (event.target instanceof HTMLElement) {
    return event.target.closest("[data-slot-index]");
  }

  return null;
}

function applyTouchTargetSizing(container) {
  const cells = container.querySelectorAll("[data-slot-index]");
  cells.forEach((cell) => {
    cell.style.minHeight = `${DEFAULT_MIN_TOUCH_SIZE}px`;
    cell.style.minWidth = `${DEFAULT_MIN_TOUCH_SIZE}px`;
  });
}

export function wireGridInteractions(args) {
  const { container, onToggle } = args;
  let dragMode = null;

  const begin = (event, mode) => {
    const cell = cellFromEvent(container, event);
    if (!cell) {
      return;
    }
    dragMode = mode;
    onToggle(Number(cell.getAttribute("data-slot-index")), mode);
  };

  const move = (event) => {
    if (!dragMode) {
      return;
    }
    const cell = cellFromEvent(container, event);
    if (!cell) {
      return;
    }
    onToggle(Number(cell.getAttribute("data-slot-index")), dragMode);
  };

  const end = () => {
    dragMode = null;
  };

  container.addEventListener("mousedown", (event) => {
    const target = cellFromEvent(container, event);
    if (!target) {
      return;
    }

    const selected = target.classList.contains("is-my-time");
    begin(event, selected ? "deselect" : "select");
  });
  container.addEventListener("mouseover", move);
  window.addEventListener("mouseup", end);

  container.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = element instanceof HTMLElement ? element.closest("[data-slot-index]") : null;
    if (!target) {
      return;
    }
    const selected = target.classList.contains("is-my-time");
    dragMode = selected ? "deselect" : "select";
    onToggle(Number(target.getAttribute("data-slot-index")), dragMode);
    event.preventDefault();
  });

  container.addEventListener("touchmove", (event) => {
    if (!dragMode) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = element instanceof HTMLElement ? element.closest("[data-slot-index]") : null;
    if (!target) {
      return;
    }
    onToggle(Number(target.getAttribute("data-slot-index")), dragMode);
    event.preventDefault();
  });

  container.addEventListener("touchend", end);
  applyTouchTargetSizing(container);
}

export function buildGrid(container, slotCount) {
  container.innerHTML = "";
  for (let i = 0; i < slotCount; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "grid-cell";
    cell.setAttribute("data-slot-index", String(i));
    cell.setAttribute("aria-label", `Slot ${i + 1}`);
    container.appendChild(cell);
  }
}
