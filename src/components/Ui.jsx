import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCalendar, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiClock, FiFileText, FiSliders, FiUploadCloud, FiX } from "react-icons/fi";

export function PageHeader({ title, subtitle, actions }) {
  return <div className="pro-page-head"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="pro-page-actions">{actions}</div>}</div>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue", trend }) {
  return <div className="pro-stat"><div className={`pro-stat-icon ${tone}`}>{Icon && <Icon />}</div><div className="pro-stat-copy"><span>{label}</span><strong>{value}</strong><div className="pro-stat-foot">{hint && <small>{hint}</small>}{trend && <em className={trend.tone || "neutral"}>{trend.label}</em>}</div></div></div>;
}

export function StatusBadge({ children, tone = "neutral" }) { return <span className={`pro-badge ${tone}`}>{children}</span>; }

export function ColumnPicker({
  columns = [],
  visible = [],
  order,
  widths = {},
  views = [],
  onToggle,
  onMove,
  onWidth,
  onReset,
  onSaveView,
  onApplyView,
  onDeleteView,
  label = "Ustunlar",
  menuTitle = "Jadval ko‘rinishi",
}) {
  const [open,setOpen]=useState(false);
  const [advanced,setAdvanced]=useState(false);
  const [viewName,setViewName]=useState("");
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return undefined;
    const close=(event)=>{if(!ref.current?.contains(event.target))setOpen(false)};
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[open]);

  const orderedColumns = useMemo(() => {
    const ids = Array.isArray(order) && order.length ? order : columns.map((column)=>column.id);
    const byId = new Map(columns.map((column)=>[column.id,column]));
    return [...new Set([...ids,...columns.map((column)=>column.id)])].map((id)=>byId.get(id)).filter(Boolean);
  },[columns,order]);

  const widthLabel=(id)=>{
    const width=Number(widths?.[id]||0);
    if(!width)return "Avto";
    if(width<=120)return "Tor";
    if(width>=220)return "Keng";
    return "O‘rta";
  };
  const cycleWidth=(id)=>{
    if(!onWidth)return;
    const width=Number(widths?.[id]||0);
    if(!width)onWidth(id,120);
    else if(width<=120)onWidth(id,170);
    else if(width<220)onWidth(id,240);
    else onWidth(id,"auto");
  };
  const saveCurrentView=()=>{
    const name=viewName.trim();
    if(!name||!onSaveView)return;
    onSaveView(name);
    setViewName("");
  };

  return <div className="column-picker" ref={ref}>
    <button type="button" className="pro-btn secondary compact-action column-picker-trigger" onClick={()=>setOpen((value)=>!value)} aria-expanded={open}><FiSliders/> {label}</button>
    {open&&<div className="column-picker-menu column-picker-menu-pro">
      <div className="column-picker-title-row"><div><strong>{menuTitle}</strong><small>Ko‘rinish, tartib va kenglikni moslang</small></div>{onReset&&<button type="button" className="column-picker-reset" onClick={onReset}>Standart</button>}</div>
      <div className="column-picker-list">
        {orderedColumns.map((column,index)=>{const checked=visible.includes(column.id);return <div className={`column-picker-row ${checked?"selected":""}`} key={column.id}>
          <button type="button" className="column-picker-check" onClick={()=>onToggle?.(column.id,!checked)} aria-pressed={checked}><span>{column.label}</span><i>{checked&&<FiCheck/>}</i></button>
          {advanced&&<div className="column-picker-tools">
            <button type="button" aria-label={`${column.label} ustunini chapga surish`} disabled={!onMove||index===0} onClick={()=>onMove?.(column.id,-1)}><FiChevronLeft/></button>
            <button type="button" aria-label={`${column.label} ustunini o‘ngga surish`} disabled={!onMove||index===orderedColumns.length-1} onClick={()=>onMove?.(column.id,1)}><FiChevronRight/></button>
            <button type="button" className="column-width-btn" disabled={!onWidth} onClick={()=>cycleWidth(column.id)}>{widthLabel(column.id)}</button>
          </div>}
        </div>})}
      </div>
      {(onMove||onWidth||onSaveView)&&<button type="button" className="column-picker-advanced" onClick={()=>setAdvanced((value)=>!value)}>{advanced?"Oddiy ko‘rinish":"Tartib va kenglik"}</button>}
      {advanced&&onSaveView&&<div className="column-view-save"><input value={viewName} maxLength={40} onChange={(event)=>setViewName(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();saveCurrentView()}}} placeholder="Ko‘rinish nomi"/><button type="button" disabled={!viewName.trim()} onClick={saveCurrentView}>Saqlash</button></div>}
      {advanced&&views?.length>0&&<div className="column-saved-views"><span>Saqlangan ko‘rinishlar</span>{views.map((view)=><div key={view.id}><button type="button" onClick={()=>onApplyView?.(view.id)}>{view.name}</button>{onDeleteView&&<button type="button" className="danger" aria-label={`${view.name} ko‘rinishini o‘chirish`} onClick={()=>onDeleteView(view.id)}><FiX/></button>}</div>)}</div>}
    </div>}
  </div>;
}

const flattenOptions = (children, out = []) => {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      flattenOptions(child.props.children, out);
      return;
    }
    if (child.type === "option") {
      const rawLabel = child.props.children;
      const label = typeof rawLabel === "string" || typeof rawLabel === "number" ? String(rawLabel) : Children.toArray(rawLabel).join("");
      out.push({
        value: child.props.value ?? label,
        label,
        disabled: Boolean(child.props.disabled),
      });
      return;
    }
    flattenOptions(child.props?.children, out);
  });
  return out;
};

export function PremiumSelect({ children, value, onChange, disabled = false, className = "", name, "aria-label": ariaLabel }) {
  const options = useMemo(() => flattenOptions(children, []), [children]);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value ?? "")));
  const selected = options.find((option) => String(option.value) === String(value ?? "")) || options[0] || { label: "Tanlang", value: "" };
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const syncPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportGap = 10;
    const preferredHeight = Math.min(320, Math.max(54, options.length * 42 + 12));
    const roomBelow = window.innerHeight - rect.bottom - viewportGap;
    const openAbove = roomBelow < Math.min(preferredHeight, 180) && rect.top > roomBelow;
    setMenuStyle({
      position: "fixed",
      left: Math.max(viewportGap, Math.min(rect.left, window.innerWidth - rect.width - viewportGap)),
      top: openAbove ? Math.max(viewportGap, rect.top - preferredHeight - 7) : rect.bottom + 7,
      width: rect.width,
      maxHeight: openAbove ? Math.min(preferredHeight, rect.top - viewportGap) : Math.min(preferredHeight, roomBelow),
      zIndex: 2600,
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(Math.max(0, options.findIndex((option) => String(option.value) === String(value ?? ""))));
    syncPosition();
    const close = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const reposition = () => syncPosition();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, options, value]);

  const choose = (option) => {
    if (!option || option.disabled) return;
    onChange?.({ target: { value: option.value, name }, currentTarget: { value: option.value, name } });
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let next = activeIndex;
      for (let i = 0; i < options.length; i += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      setActiveIndex(next);
      return;
    }
    if (event.key === "Enter") { event.preventDefault(); choose(options[activeIndex]); }
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`premium-select ${className}`.trim()}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={() => { if (!disabled) setOpen((state) => !state); }}
      onKeyDown={onKeyDown}
    >
      <span>{selected.label}</span><FiChevronDown className={open ? "rotate" : ""}/>
    </button>
    {open && createPortal(<div ref={menuRef} className="premium-select-menu" style={menuStyle} role="listbox">
      {options.map((option, index) => {
        const current = String(option.value) === String(value ?? "");
        return <button
          key={`${String(option.value)}-${index}`}
          type="button"
          role="option"
          aria-selected={current}
          disabled={option.disabled}
          className={`${current ? "selected" : ""} ${activeIndex === index ? "active" : ""}`.trim()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        ><span>{option.label}</span>{current && <FiCheck/>}</button>;
      })}
    </div>, document.body)}
  </>;
}


const pad2 = (value) => String(value).padStart(2, "0");
const parseISODate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};
const isoDate = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;
const displayISODate = (value) => {
  const parsed = parseISODate(value);
  return parsed ? `${pad2(parsed.day)}.${pad2(parsed.month)}.${parsed.year}` : "";
};
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const mondayIndex = (year, month) => {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
};
const compareISODate = (left, right) => String(left || "").localeCompare(String(right || ""));

export function PremiumDateInput({
  value = "",
  onChange,
  min = "",
  max = "",
  disabled = false,
  className = "",
  name,
  placeholder = "Sana tanlang",
  "aria-label": ariaLabel,
}) {
  const today = useMemo(() => {
    const now = new Date();
    return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);
  const initial = parseISODate(value) || parseISODate(today);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const parsed = parseISODate(value);
    if (parsed && !open) setView({ year: parsed.year, month: parsed.month });
  }, [value, open]);

  const syncPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const menuWidth = Math.max(286, Math.min(326, Math.max(rect.width, 286)));
    const menuHeight = 350;
    const roomBelow = window.innerHeight - rect.bottom - gap;
    const openAbove = roomBelow < 300 && rect.top > roomBelow;
    setMenuStyle({
      position: "fixed",
      left: Math.max(10, Math.min(rect.left, window.innerWidth - menuWidth - 10)),
      top: openAbove ? Math.max(10, rect.top - menuHeight - gap) : rect.bottom + gap,
      width: menuWidth,
      zIndex: 2650,
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    syncPosition();
    const close = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const reposition = () => syncPosition();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const emit = (nextValue) => {
    onChange?.({ target: { value: nextValue, name }, currentTarget: { value: nextValue, name } });
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const allowed = (nextValue) => (!min || compareISODate(nextValue, min) >= 0) && (!max || compareISODate(nextValue, max) <= 0);
  const moveMonth = (delta) => setView((current) => {
    let month = current.month + delta;
    let year = current.year;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    return { year, month };
  });

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const weekdayNames = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
  const leading = mondayIndex(view.year, view.month);
  const total = daysInMonth(view.year, view.month);
  const previousMonth = view.month === 1 ? { year: view.year - 1, month: 12 } : { year: view.year, month: view.month - 1 };
  const previousTotal = daysInMonth(previousMonth.year, previousMonth.month);
  const cells = Array.from({ length: 42 }, (_, index) => {
    if (index < leading) {
      const day = previousTotal - leading + index + 1;
      return { day, month: previousMonth.month, year: previousMonth.year, muted: true };
    }
    if (index < leading + total) return { day: index - leading + 1, month: view.month, year: view.year, muted: false };
    const next = view.month === 12 ? { year: view.year + 1, month: 1 } : { year: view.year, month: view.month + 1 };
    return { day: index - leading - total + 1, month: next.month, year: next.year, muted: true };
  });

  const openPicker = () => {
    if (disabled) return;
    const parsed = parseISODate(value) || parseISODate(today);
    setView({ year: parsed.year, month: parsed.month });
    setOpen((state) => !state);
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`premium-date ${className}`.trim()}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
        if (!open && ["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); openPicker(); }
      }}
    >
      <FiCalendar/><span className={value ? "" : "placeholder"}>{displayISODate(value) || placeholder}</span><FiChevronDown className={open ? "rotate" : ""}/>
    </button>
    {open && createPortal(<div ref={menuRef} className="premium-date-menu" style={menuStyle} role="dialog" aria-label="Sana tanlash">
      <div className="premium-date-head">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Oldingi oy"><FiChevronLeft/></button>
        <strong>{monthNames[view.month - 1]} {view.year}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Keyingi oy"><FiChevronRight/></button>
      </div>
      <div className="premium-date-weekdays">{weekdayNames.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="premium-date-grid">{cells.map((cell, index) => {
        const dateValue = isoDate(cell.year, cell.month, cell.day);
        const selected = dateValue === value;
        const isToday = dateValue === today;
        const isDisabled = !allowed(dateValue);
        return <button
          type="button"
          key={`${dateValue}-${index}`}
          className={`${cell.muted ? "muted" : ""} ${selected ? "selected" : ""} ${isToday ? "today" : ""}`.trim()}
          disabled={isDisabled}
          onClick={() => emit(dateValue)}
        >{cell.day}</button>;
      })}</div>
      <div className="premium-date-foot">
        <button type="button" disabled={!allowed(today)} onClick={() => emit(today)}>Bugun</button>
        {value && <button type="button" onClick={() => emit("")}>Tozalash</button>}
      </div>
    </div>, document.body)}
  </>;
}


const parseTimeValue = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return { hour: "00", minute: "00" };
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return { hour: pad2(hour), minute: pad2(minute) };
};

export function PremiumTimeInput({
  value = "",
  onChange,
  disabled = false,
  className = "",
  name,
  placeholder = "Vaqt tanlang",
  "aria-label": ariaLabel,
}) {
  const parsed = parseTimeValue(value || "00:00");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parsed);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) setDraft(parseTimeValue(value || "00:00"));
  }, [value, open]);

  const syncPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const width = Math.max(230, Math.min(270, rect.width));
    const height = 330;
    const roomBelow = window.innerHeight - rect.bottom - gap;
    const openAbove = roomBelow < 260 && rect.top > roomBelow;
    setMenuStyle({
      position: "fixed",
      left: Math.max(10, Math.min(rect.left, window.innerWidth - width - 10)),
      top: openAbove ? Math.max(10, rect.top - height - gap) : rect.bottom + gap,
      width,
      zIndex: 2650,
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    syncPosition();
    const close = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const reposition = () => syncPosition();
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const emit = () => {
    const nextValue = `${draft.hour}:${draft.minute}`;
    onChange?.({ target: { value: nextValue, name }, currentTarget: { value: nextValue, name } });
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const hours = Array.from({ length: 24 }, (_, index) => pad2(index));
  const minutes = Array.from({ length: 60 }, (_, index) => pad2(index));
  const display = value || placeholder;

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`premium-time ${className}`.trim()}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={() => { if (!disabled) { setDraft(parseTimeValue(value || "00:00")); setOpen((state) => !state); } }}
    >
      <FiClock/><span className={value ? "" : "placeholder"}>{display}</span><FiChevronDown className={open ? "rotate" : ""}/>
    </button>
    {open && createPortal(<div ref={menuRef} className="premium-time-menu" style={menuStyle} role="dialog" aria-label="Vaqt tanlash">
      <div className="premium-time-labels"><span>Soat</span><span>Daqiqa</span></div>
      <div className="premium-time-columns">
        <div className="premium-time-column">{hours.map((hour) => <button type="button" key={hour} className={draft.hour === hour ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, hour }))}>{hour}</button>)}</div>
        <div className="premium-time-column">{minutes.map((minute) => <button type="button" key={minute} className={draft.minute === minute ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, minute }))}>{minute}</button>)}</div>
      </div>
      <div className="premium-time-foot"><button type="button" onClick={() => setOpen(false)}>Bekor qilish</button><strong>{draft.hour}:{draft.minute}</strong><button type="button" className="primary" onClick={emit}>Tanlash</button></div>
    </div>, document.body)}
  </>;
}


export function FilePicker({
  file,
  onChange,
  onClear,
  accept,
  label = "Fayl tanlash",
  hint = "PDF, rasm yoki hujjat",
  existingName = "",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const name = file?.name || existingName || "";
  return <div className={`zenix-file-picker ${name ? "has-file" : ""} ${disabled ? "disabled" : ""}`.trim()}>
    <input
      ref={inputRef}
      className="zenix-file-native"
      type="file"
      tabIndex={-1}
      accept={accept}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.files?.[0] || null, event)}
    />
    <button type="button" className="zenix-file-main" disabled={disabled} onClick={() => inputRef.current?.click()}>
      <span className="zenix-file-icon">{name ? <FiFileText/> : <FiUploadCloud/>}</span>
      <span className="zenix-file-copy">
        <strong>{name || label}</strong>
        <small>{name ? "O‘zgartirish uchun bosing" : hint}</small>
      </span>
    </button>
    {name && <button type="button" className="zenix-file-clear" aria-label="Faylni olib tashlash" disabled={disabled} onClick={() => {
      if (inputRef.current) inputRef.current.value = "";
      onClear?.();
    }}><FiX/></button>}
  </div>;
}


export function MultiFilePicker({
  onChange,
  accept,
  label = "Fayllarni tanlang",
  hint = "Bir yoki bir nechta faylni tanlang yoki shu yerga tashlang",
  disabled = false,
  busy = false,
  className = "",
  multiple = true,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const emit = (files, event) => {
    const list = Array.from(files || []);
    if (!list.length || disabled || busy) return;
    onChange?.(list, event);
  };

  const onDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    emit(event.dataTransfer?.files, event);
  };

  return <div
    className={`zenix-multi-file ${dragging ? "dragging" : ""} ${disabled || busy ? "disabled" : ""} ${className}`.trim()}
    onDragEnter={(event) => { event.preventDefault(); if (!disabled && !busy) setDragging(true); }}
    onDragOver={(event) => { event.preventDefault(); if (!disabled && !busy) event.dataTransfer.dropEffect = "copy"; }}
    onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    }}
    onDrop={onDrop}
  >
    <input
      ref={inputRef}
      className="zenix-file-native"
      type="file"
      tabIndex={-1}
      multiple={multiple}
      accept={accept}
      disabled={disabled || busy}
      onChange={(event) => {
        emit(event.target.files, event);
        event.target.value = "";
      }}
    />
    <button type="button" className="zenix-multi-file-main" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
      <span className="zenix-multi-file-icon"><FiUploadCloud/></span>
      <span>
        <strong>{busy ? "Fayllar tahlil qilinmoqda..." : label}</strong>
        <small>{dragging ? "Fayllarni tashlang" : hint}</small>
      </span>
    </button>
  </div>;
}


export function PremiumCheckbox({ checked = false, onChange, disabled = false, className = "", children, title, description }) {
  return <label className={`premium-check ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}/>
    <span className="premium-check-box"><FiCheck/></span>
    {(children || title || description) && <span className="premium-check-copy">
      {children || <>{title && <strong>{title}</strong>}{description && <small>{description}</small>}</>}
    </span>}
  </label>;
}


export function EmptyState({ icon: Icon, title = "Ma’lumot yo‘q", message = "Hozircha ko‘rsatish uchun ma’lumot topilmadi.", action }) {
  return <div className="pro-empty zenix-empty-state">
    {Icon && <span className="zenix-empty-icon"><Icon /></span>}
    <strong>{title}</strong>
    <span>{message}</span>
    {action && <div className="zenix-empty-action">{action}</div>}
  </div>;
}

export function PageSkeleton({ cards = 4 }) {
  return <div className="page-skeleton" aria-hidden="true">
    <div className="skeleton-head"><span/><span/></div>
    <div className="skeleton-grid">{Array.from({ length: cards }).map((_, index) => <span key={index}/>)}</div>
    <div className="skeleton-panel"/>
  </div>;
}
