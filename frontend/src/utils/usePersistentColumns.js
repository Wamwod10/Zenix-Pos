import { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/StoreContext";

const normalizeOrder = (order, ids) => {
  const known = Array.isArray(order) ? order.filter((id) => ids.includes(id)) : [];
  return [...new Set([...known, ...ids])];
};

const normalizeVisible = (visible, ids, requiredIds, fallback) => {
  const known = Array.isArray(visible) ? visible.filter((id) => ids.includes(id)) : [];
  const withRequired = [...new Set([...requiredIds, ...(known.length ? known : fallback)])];
  return withRequired.length ? withRequired : fallback;
};

const normalizeWidths = (widths, ids) => Object.fromEntries(
  Object.entries(widths && typeof widths === "object" ? widths : {})
    .filter(([id, value]) => ids.includes(id) && Number.isFinite(Number(value)))
    .map(([id, value]) => [id, Math.max(80, Math.min(420, Number(value)))])
);

const normalizeViews = (views, ids, requiredIds, fallback) => (Array.isArray(views) ? views : [])
  .filter((view) => view && typeof view === "object" && view.id && view.name)
  .slice(0, 8)
  .map((view) => ({
    id: String(view.id),
    name: String(view.name).slice(0, 40),
    visible: normalizeVisible(view.visible, ids, requiredIds, fallback),
    order: normalizeOrder(view.order, ids),
    widths: normalizeWidths(view.widths, ids),
  }));

const buildState = (stored, ids, requiredIds, fallback) => {
  if (Array.isArray(stored)) {
    return {
      visible: normalizeVisible(stored, ids, requiredIds, fallback),
      order: normalizeOrder(stored, ids),
      widths: {},
      views: [],
    };
  }
  return {
    visible: normalizeVisible(stored?.visible, ids, requiredIds, fallback),
    order: normalizeOrder(stored?.order, ids),
    widths: normalizeWidths(stored?.widths, ids),
    views: normalizeViews(stored?.views, ids, requiredIds, fallback),
  };
};

export default function usePersistentColumns(storageKey, definitions = [], { required = [], initialVisible = null } = {}) {
  const { uiPreferences, setUiPreferences, workspaceReady } = useStore();
  const ids = useMemo(() => definitions.map((column) => column.id), [definitions]);
  const requiredIds = useMemo(() => required.filter((id) => ids.includes(id)), [required, ids]);
  const fallback = useMemo(() => {
    const initial = Array.isArray(initialVisible) ? initialVisible.filter((id) => ids.includes(id)) : ids;
    return [...new Set([...requiredIds, ...(initial.length ? initial : ids)])];
  }, [requiredIds, ids, initialVisible]);
  const storedLayout=uiPreferences?.tableLayouts?.[storageKey]||null;
  const [state, setState] = useState(() => buildState(storedLayout,ids,requiredIds,fallback));

  useEffect(()=>{
    if(!workspaceReady)return;
    setState(buildState(storedLayout,ids,requiredIds,fallback));
  },[workspaceReady,storageKey,storedLayout,ids,requiredIds,fallback]);

  const persist = (patch) => {
    setState((current) => {
      const next = { ...current, ...patch };
      next.visible = normalizeVisible(next.visible, ids, requiredIds, fallback);
      next.order = normalizeOrder(next.order, ids);
      next.widths = normalizeWidths(next.widths, ids);
      next.views = normalizeViews(next.views, ids, requiredIds, fallback);
      setUiPreferences((previous)=>({
        ...previous,
        tableLayouts:{...(previous?.tableLayouts||{}),[storageKey]:next},
      }));
      return next;
    });
  };

  const toggle = (id, checked) => {
    if (!ids.includes(id) || requiredIds.includes(id)) return;
    const isVisible = state.visible.includes(id);
    const next = checked === undefined
      ? (isVisible ? state.visible.filter((item) => item !== id) : [...state.visible, id])
      : (checked ? [...state.visible, id] : state.visible.filter((item) => item !== id));
    persist({ visible: next });
  };

  const move = (id, direction) => {
    const index = state.order.indexOf(id);
    if (index < 0) return;
    const offset = direction === "left" || direction === "up" || Number(direction) < 0 ? -1 : 1;
    const target = index + offset;
    if (target < 0 || target >= state.order.length) return;
    const next = [...state.order];
    [next[index], next[target]] = [next[target], next[index]];
    persist({ order: next });
  };

  const setWidth = (id, width) => {
    if (!ids.includes(id)) return;
    if (width == null || width === "auto") {
      const next = { ...state.widths };
      delete next[id];
      persist({ widths: next });
      return;
    }
    persist({ widths: { ...state.widths, [id]: Math.max(80, Math.min(420, Number(width) || 140)) } });
  };

  const saveView = (name) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const existing = state.views.find((view) => view.name.toLocaleLowerCase("uz") === cleanName.toLocaleLowerCase("uz"));
    const id = existing?.id || crypto.randomUUID();
    const snapshot = { id, name: cleanName.slice(0, 40), visible: state.visible, order: state.order, widths: state.widths };
    const nextViews = existing
      ? state.views.map((view) => view.id === id ? snapshot : view)
      : [...state.views, snapshot].slice(-8);
    persist({ views: nextViews });
    return id;
  };

  const applyView = (id) => {
    const view = state.views.find((item) => item.id === id);
    if (!view) return;
    persist({ visible: view.visible, order: view.order, widths: view.widths });
  };

  const deleteView = (id) => persist({ views: state.views.filter((view) => view.id !== id) });
  const reset = () => persist({ visible: fallback, order: ids, widths: {} });
  const show = (id) => state.visible.includes(id);
  const orderedDefinitions = state.order.map((id) => definitions.find((column) => column.id === id)).filter(Boolean);
  const orderedVisibleDefinitions = orderedDefinitions.filter((column) => state.visible.includes(column.id));
  const columnStyle = (id) => state.widths[id] ? { width: `${state.widths[id]}px`, minWidth: `${state.widths[id]}px` } : undefined;

  return {
    visible: state.visible,
    order: state.order,
    widths: state.widths,
    views: state.views,
    toggle,
    move,
    setWidth,
    saveView,
    applyView,
    deleteView,
    reset,
    show,
    orderedDefinitions,
    orderedVisibleDefinitions,
    columnStyle,
  };
}
