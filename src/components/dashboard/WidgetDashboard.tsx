// src/components/dashboard/WidgetDashboard.tsx
// Android 16-style: resize + drag-to-reorder widget system
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid, Maximize2, Minimize2, RotateCcw, GripVertical } from 'lucide-react';

export type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '3x2';

export interface Widget {
  id: string;
  size: WidgetSize;
  title: string;
  order: number;
}

// Size options with explicit colSpan/rowSpan
export const SIZE_OPTIONS = [
  { label: 'Small',  value: '1x1' as WidgetSize, colSpan: 1, rowSpan: 1, icon: '◾', desc: '1 col' },
  { label: 'Wide',   value: '2x1' as WidgetSize, colSpan: 2, rowSpan: 1, icon: '▬',  desc: '2 cols' },
  { label: 'Tall',   value: '1x2' as WidgetSize, colSpan: 1, rowSpan: 2, icon: '▮',  desc: '1 col × 2' },
  { label: 'Medium', value: '2x2' as WidgetSize, colSpan: 2, rowSpan: 2, icon: '◼',  desc: '2×2' },
  { label: 'Banner', value: '3x1' as WidgetSize, colSpan: 3, rowSpan: 1, icon: '━',  desc: 'Full width' },
  { label: 'Large',  value: '3x2' as WidgetSize, colSpan: 3, rowSpan: 2, icon: '⬛', desc: 'Full ×2' },
] as const;

export const getSizeStyle = (size: WidgetSize): React.CSSProperties => {
  const opt = SIZE_OPTIONS.find(s => s.value === size);
  if (!opt) return {};
  return {
    gridColumn: `span ${opt.colSpan}`,
    gridRow:    `span ${opt.rowSpan}`,
    minHeight:  opt.rowSpan >= 2 ? '400px' : '200px',
  };
};

// ─── WidgetWrapper ───────────────────────────────────────────────────────────
interface WidgetWrapperProps {
  widget: Widget;
  onResize: (id: string, size: WidgetSize) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  draggingId: string | null;
  dragOverId: string | null;
  children: React.ReactNode;
  editMode: boolean;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  widget, onResize, onDragStart, onDragOver, onDrop,
  draggingId, dragOverId, children, editMode,
}) => {
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSizeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDragging  = draggingId === widget.id;
  const isDragOver  = dragOverId === widget.id && draggingId !== widget.id;
  const currentSize = SIZE_OPTIONS.find(s => s.value === widget.size) || SIZE_OPTIONS[0];

  return (
    <div
      style={getSizeStyle(widget.size)}
      className={`relative transition-all duration-300 ${isDragging ? 'opacity-40 scale-[0.97]' : ''}`}
      draggable={editMode}
      onDragStart={() => onDragStart(widget.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(widget.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(widget.id); }}
      onDragEnd={() => onDrop(widget.id)}
    >
      {/* Card content */}
      <div className={`h-full rounded-2xl overflow-hidden transition-all duration-200 ${
        editMode
          ? isDragOver
            ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-transparent shadow-2xl shadow-primary-900/30'
            : 'ring-2 ring-primary-500/30 shadow-lg shadow-primary-900/10'
          : ''
      }`}>
        {children}
      </div>

      {/* Edit mode controls */}
      {editMode && (
        <>
          {/* Drag handle — top left */}
          <div
            className="absolute top-3 left-3 z-20 flex items-center justify-center w-7 h-7 rounded-xl bg-background-900/90 backdrop-blur-sm border border-white/10 cursor-grab active:cursor-grabbing shadow-lg hover:bg-background-800 transition-all"
            title="Drag to reorder"
          >
            <GripVertical size={14} className="text-gray-400" />
          </div>

          {/* Resize button — top right */}
          <div className="absolute top-3 right-3 z-20" ref={menuRef}>
            <button
              onClick={() => setShowSizeMenu(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background-900/95 backdrop-blur-sm border border-white/15 rounded-xl text-xs text-white font-semibold shadow-lg hover:bg-background-800 active:scale-95 transition-all"
            >
              <Maximize2 size={11} />
              <span>{currentSize.label}</span>
            </button>

            {showSizeMenu && (
              <div className="absolute top-full right-0 mt-2 p-2 bg-background-950/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 w-48"
                style={{ animation: 'slideDown 0.15s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-2 mb-2">Widget Size</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { onResize(widget.id, opt.value); setShowSizeMenu(false); }}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-xs font-medium transition-all ${
                        widget.size === opt.value
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-900/40'
                          : 'bg-background-800 text-gray-400 hover:bg-background-700 hover:text-white'
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[9px] opacity-50">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drag-over indicator */}
          {isDragOver && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-primary-400/60 border-dashed" />
          )}
        </>
      )}
    </div>
  );
};

// ─── WidgetGrid ──────────────────────────────────────────────────────────────
interface WidgetGridProps {
  widgets: Widget[];
  onReorder: (reordered: Widget[]) => void;
  onResize: (id: string, size: WidgetSize) => void;
  editMode: boolean;
  children: (widget: Widget) => React.ReactNode;
}

export const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets, onReorder, onResize, editMode, children,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback((id: string) => {
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = widgets.findIndex(w => w.id === draggingId);
    const toIdx   = widgets.findIndex(w => w.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...widgets];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const withOrder = reordered.map((w, i) => ({ ...w, order: i }));
    onReorder(withOrder);
    setDraggingId(null);
    setDragOverId(null);
  }, [draggingId, widgets, onReorder]);

  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gridAutoRows: 'minmax(200px, auto)',
      }}
      onDragLeave={() => setDragOverId(null)}
    >
      {sorted.map(widget => (
        <WidgetWrapper
          key={widget.id}
          widget={widget}
          onResize={onResize}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          draggingId={draggingId}
          dragOverId={dragOverId}
          editMode={editMode}
        >
          {children(widget)}
        </WidgetWrapper>
      ))}
    </div>
  );
};

// ─── Edit Mode Bar ────────────────────────────────────────────────────────────
interface WidgetEditBarProps {
  editMode: boolean;
  onToggleEdit: () => void;
  onReset: () => void;
}

export const WidgetEditBar: React.FC<WidgetEditBarProps> = ({ editMode, onToggleEdit, onReset }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl transition-all duration-300 ${
    editMode
      ? 'bg-primary-900/50 border border-primary-500/30 shadow-lg shadow-primary-900/20'
      : 'bg-background-800/80 border border-white/5'
  }`}>
    <LayoutGrid size={14} className={editMode ? 'text-primary-400' : 'text-gray-500'} />
    <span className={`text-xs font-semibold ${editMode ? 'text-primary-300' : 'text-gray-500'}`}
      style={{ fontFamily: "'Outfit', sans-serif" }}>
      {editMode ? 'Editing Layout' : 'Customize'}
    </span>
    {editMode && (
      <button
        onClick={onReset}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors ml-1 font-medium"
      >
        <RotateCcw size={10} /> Reset
      </button>
    )}
    <button
      onClick={onToggleEdit}
      className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
        editMode
          ? 'bg-primary-600 text-white hover:bg-primary-500 shadow-md'
          : 'bg-background-700 text-gray-300 hover:bg-background-600 hover:text-white'
      }`}
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      {editMode
        ? <><Minimize2 size={11}/> Done</>
        : <><Maximize2 size={11}/> Resize & Reorder</>
      }
    </button>
  </div>
);
