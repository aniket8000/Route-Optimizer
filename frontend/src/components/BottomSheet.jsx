import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./BottomSheet.css";

// mobile-only panel that sits over the map, google-maps style. collapsed it shows just the
// `peek` content (stats + main button), drag or tap the handle to pull up the rest.
// onPeekHeightChange reports how much of the screen the collapsed sheet covers, so the map
// can keep pins and controls clear of it.
export default function BottomSheet({ expanded, onExpandedChange, peek, children, onPeekHeightChange }) {
  const sheetRef = useRef(null);
  const peekRef = useRef(null);
  const dragRef = useRef(null);
  const [collapsedOffset, setCollapsedOffset] = useState(0);
  const [dragOffset, setDragOffset] = useState(null);

  // collapsed = the sheet pushed down so only the handle + peek section is still on screen.
  // re-measured whenever either changes size (banners appearing, route getting optimized...)
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const peekEl = peekRef.current;
    if (!sheet || !peekEl) return;

    const measure = () => {
      const peekBottom = peekEl.offsetTop + peekEl.offsetHeight + 14;
      setCollapsedOffset(Math.max(0, sheet.offsetHeight - peekBottom));
      onPeekHeightChange?.(peekBottom);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    observer.observe(peekEl);
    return () => observer.disconnect();
  }, [onPeekHeightChange]);

  // back button / escape shouldn't be needed to get out of an expanded sheet, but escape is cheap
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => e.key === "Escape" && onExpandedChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onExpandedChange]);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startOffset: expanded ? 0 : collapsedOffset,
      moved: false,
    };
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) {
      setDragOffset(Math.min(collapsedOffset, Math.max(0, drag.startOffset + dy)));
    }
  }

  function onPointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (!drag.moved) {
      onExpandedChange(!expanded); // plain tap on the handle just toggles
    } else {
      const dy = e.clientY - drag.startY;
      // a decent flick wins, otherwise snap to whichever end is closer
      if (dy < -50) onExpandedChange(true);
      else if (dy > 50) onExpandedChange(false);
      else onExpandedChange((dragOffset ?? drag.startOffset) < collapsedOffset / 2);
    }
    setDragOffset(null);
  }

  const offset = dragOffset ?? (expanded ? 0 : collapsedOffset);

  return (
    <section
      ref={sheetRef}
      className={`sheet ${expanded ? "is-expanded" : ""} ${dragOffset != null ? "is-dragging" : ""}`}
      style={{ transform: `translateY(${offset}px)` }}
      aria-label="Route details"
    >
      <button
        type="button"
        className="sheet-handle"
        aria-label={expanded ? "Collapse route details" : "Expand route details"}
        aria-expanded={expanded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragOffset(null);
        }}
      >
        <span />
      </button>

      <div className="sheet-peek" ref={peekRef}>
        {peek}
      </div>

      <div className="sheet-body">{children}</div>
    </section>
  );
}
