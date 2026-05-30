import { fetchGrid, patchAvailability } from "./api.js";
import { applyCellsToDom, buildGridState } from "./layers.js";
import { buildGrid, wireGridInteractions } from "./grid.js";

function tokenFromPath() {
  const metaToken = document.querySelector("meta[name=event-token]")?.getAttribute("content");
  if (metaToken) {
    return metaToken;
  }

  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[1] || "";
}

function slotCountFromMeta() {
  const meta = document.querySelector("meta[name=slot-count]");
  return Number(meta?.getAttribute("content") || "0");
}

export function mountEventApp() {
  const container = document.querySelector("#event-grid");
  const nEl = document.querySelector("#submitted-n");
  const emptyState = document.querySelector("#empty-state");
  const feedback = document.querySelector("#sync-feedback");
  if (
    !(container instanceof HTMLElement) ||
    !(nEl instanceof HTMLElement) ||
    !(emptyState instanceof HTMLElement) ||
    !(feedback instanceof HTMLElement)
  ) {
    return;
  }

  const token = tokenFromPath();
  const slotCount = slotCountFromMeta();
  if (!token || !slotCount) {
    feedback.textContent = "Invalid event context.";
    return;
  }

  let current = {
    n: 0,
    mine: new Set(),
    previousN: 0
  };

  const pending = {
    select: new Set(),
    deselect: new Set(),
    timer: null
  };

  buildGrid(container, slotCount);

  const render = (payload) => {
    const state = buildGridState(payload, slotCount);
    applyCellsToDom(container, state);
    nEl.textContent = String(payload.n);

    const showEmpty = payload.n > 0 && !state.hasPerfect;
    emptyState.hidden = !showEmpty;

    if (payload.n > current.previousN) {
      feedback.textContent = "參與者已更新，交集已重新計算";
      feedback.classList.add("is-info");
      feedback.classList.remove("is-error");
    }

    current = {
      n: payload.n,
      mine: state.mineSet,
      previousN: payload.n
    };
  };

  const queueSync = () => {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    pending.timer = window.setTimeout(async () => {
      const diff = {
        select: [...pending.select],
        deselect: [...pending.deselect]
      };

      pending.select.clear();
      pending.deselect.clear();

      try {
        await patchAvailability(token, diff);
        feedback.textContent = "";
      } catch (error) {
        feedback.textContent = "Sync failed. Changes were rolled back. Retrying is available.";
        feedback.classList.add("is-error");
        feedback.classList.remove("is-info");
        await load();
        return;
      }

      await load();
    }, 300);
  };

  const applyOptimisticToggle = (index, mode) => {
    if (mode === "select") {
      current.mine.add(index);
      pending.deselect.delete(index);
      pending.select.add(index);
    } else {
      current.mine.delete(index);
      pending.select.delete(index);
      pending.deselect.add(index);
    }

    const payload = {
      n: current.n,
      slots: [],
      mine: [...current.mine]
    };
    const state = buildGridState(payload, slotCount);
    applyCellsToDom(container, state);
    queueSync();
  };

  wireGridInteractions({
    container,
    onToggle: applyOptimisticToggle
  });

  const load = async () => {
    const payload = await fetchGrid(token);
    render(payload);
  };

  const poll = () => {
    if (document.visibilityState === "visible") {
      void load();
    }
  };

  void load();
  window.setInterval(poll, 4000);
}
