import { classifyHeatmapCell } from "./encoding.js";

export function buildGridState(payload, slotCount) {
  const mineSet = new Set(payload.mine ?? []);
  const countMap = new Map((payload.slots ?? []).map((entry) => [entry.i, entry.count]));
  const cells = [];

  for (let index = 0; index < slotCount; index += 1) {
    const count = countMap.get(index) ?? 0;
    const mine = mineSet.has(index);
    cells.push({
      index,
      ...classifyHeatmapCell({
        n: payload.n,
        count,
        mine
      }),
      count
    });
  }

  const hasPerfect = cells.some((cell) => cell.perfect);

  return {
    n: payload.n,
    cells,
    hasPerfect,
    mineSet
  };
}

export function applyCellsToDom(container, state) {
  const nodes = container.querySelectorAll("[data-slot-index]");
  nodes.forEach((node) => {
    const idx = Number(node.getAttribute("data-slot-index"));
    const cell = state.cells[idx];
    if (!cell) {
      return;
    }

    node.classList.toggle("is-perfect", cell.perfect);
    node.classList.toggle("is-near-perfect", cell.nearPerfect);
    node.classList.toggle("is-only-missing-me", cell.onlyMissingMe);
    node.classList.toggle("is-my-time", cell.myTime);
    node.setAttribute("data-count", String(cell.count));
  });
}
