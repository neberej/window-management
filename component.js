
import React, { useContext, useState, useRef, useEffect } from 'react';
import { Notepad, Browser, Video } from './window';
import CONFIG from './config';
import './grid.scss';
import './grid2.scss';


// Utility function to clamp values within bounds
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Utility function to snap window to edges
const snapToEdges = (pos, size, windows, currentId, threshold) => {
  let { x, y } = pos;
  const desktop = document.querySelector('.desktop')?.getBoundingClientRect();
  if (!desktop) return { x, y };

  const edges = [
    { x: 0, y: CONFIG.TOOLBAR_HEIGHT },
    { x: desktop.width - size.width, y: desktop.height - size.height - CONFIG.TASKBAR_HEIGHT }
  ];

  windows.forEach(win => {
    if (win.id !== currentId && !win.isMinimized) {
      edges.push(
        { x: win.pos.x, y: win.pos.y },
        { x: win.pos.x + win.size.width, y: win.pos.y + win.size.height }
      );
    }
  });

  edges.forEach(edge => {
    if (Math.abs(x - edge.x) < threshold) x = edge.x;
    if (Math.abs(y - edge.y) < threshold) y = edge.y;
  });

  return { x, y };
};

// Utility functions for window state management
const updateWindowState = (windows, id, updates) =>
  windows.map(w => (w.id === id ? { ...w, ...updates } : w));

const toggleWindowState = (windows, id) =>
  windows.map(w =>
    w.id === id
      ? {
          ...w,
          isMinimized: !w.isMinimized,
          isMaximized: !w.isMinimized ? false : w.isMaximized,
          pos: { ...w.pos, y: Math.max(CONFIG.TOOLBAR_HEIGHT, w.pos.y) }
        }
      : w
  );

const maximizeWindowState = (windows, id, desktopRect) =>
  windows.map(w => {
    if (w.id !== id) return { ...w, isMinimized: true };
    if (w.isMaximized) {
      return {
        ...w,
        pos: w.prevPos,
        size: w.prevSize,
        isMinimized: false,
        isMaximized: false
      };
    }
    return {
      ...w,
      prevPos: { ...w.pos },
      prevSize: { ...w.size },
      pos: { x: 0, y: CONFIG.TOOLBAR_HEIGHT },
      size: {
        width: desktopRect.width,
        height: desktopRect.height - CONFIG.TOOLBAR_HEIGHT - CONFIG.TASKBAR_HEIGHT
      },
      isMinimized: false,
      isMaximized: true
    };
  });

const bringToFront = (windows, id) => {
  const maxZIndex = Math.max(...windows.map(w => w.zIndex || CONFIG.DEFAULT_WINDOW.BASE_Z_INDEX)) + 1;
  return windows.map(w => (w.id === id ? { ...w, zIndex: maxZIndex } : w));
};


// Resize Handles Component
const ResizeHandles = ({ startResize }) => {
  const directions = ['ne', 'nw', 'se', 'sw', 'n', 's', 'e', 'w'];
  return directions.map(dir => (
    <div
      key={dir}
      className={`resize-handle ${dir}`}
      onMouseDown={e => startResize(e, dir)}
    />
  ));
};

// Window Title Component
const WindowTitle = ({ appWin, updateWindow, bringWindowToFront }) => {
  const [isEditing, setIsEditing] = useState(false);

  const updateTitle = e => updateWindow(appWin.id, { title: e.target.value });
  const saveTitle = e => e.key === 'Enter' && setIsEditing(false);

  return (
    <div className="window-title">
      {isEditing ? (
        <input
          className="title-input"
          value={appWin.title}
          onChange={updateTitle}
          onBlur={() => setIsEditing(false)}
          onKeyDown={saveTitle}
          onClick={e => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <>
          {appWin.title}
          <span
            className="pencil-icon"
            onClick={() => {
              setIsEditing(true);
              bringWindowToFront(appWin.id);
            }}
          >
            ✎
          </span>
        </>
      )}
    </div>
  );
};

// Window Controls Component
const WindowControls = ({ appWin, minimize, maximize, close }) => (
  <div className="window-controls">
    <span className="minimize-btn" onClick={minimize}>–</span>
    <span className="maximize-btn" onClick={maximize}>□</span>
    <span className="close-btn" onClick={close}>×</span>
  </div>
);

// App Window Component
const AppWindow = ({ appWin, context }) => {
  const { updateWindow, closeWindow, maximizeWindow, windows, bringWindowToFront } = useContext(context);
  const [dragState, setDragState] = useState({ isActive: false, startX: 0, startY: 0 });
  const [resizeState, setResizeState] = useState({
    isActive: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    dir: ''
  });

  // Handle mouse events for dragging and resizing
  useEffect(() => {
    if (appWin.isMinimized || (!dragState.isActive && !resizeState.isActive)) return;

    const handleMouseMove = e => {
      if (dragState.isActive) {
        const desktop = document.querySelector('.desktop').getBoundingClientRect();
        let x = e.clientX - dragState.startX;
        let y = e.clientY - dragState.startY;

        ({ x, y } = snapToEdges({ x, y }, appWin.size, windows, appWin.id, CONFIG.SNAP_THRESHOLD));
        x = clamp(x, 0, desktop.width - appWin.size.width);
        y = clamp(y, CONFIG.TOOLBAR_HEIGHT, desktop.height - appWin.size.height - CONFIG.TASKBAR_HEIGHT);

        updateWindow(appWin.id, { pos: { x, y } });
      } else if (resizeState.isActive) {
        const { dir, startX, startY, startWidth, startHeight } = resizeState;
        const desktop = document.querySelector('.desktop').getBoundingClientRect();
        let { width, height } = appWin.size;
        let { x, y } = appWin.pos;

        // Calculate new size and position based on resize direction
        if (dir === 'ne') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth + (e.clientX - startX));
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight - (e.clientY - startY));
          y = appWin.pos.y + (e.clientY - startY);
        } else if (dir === 'nw') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth - (e.clientX - startX));
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight - (e.clientY - startY));
          x = appWin.pos.x + (e.clientX - startX);
          y = appWin.pos.y + (e.clientY - startY);
        } else if (dir === 'se') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth + (e.clientX - startX));
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight + (e.clientY - startY));
        } else if (dir === 'sw') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth - (e.clientX - startX));
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight + (e.clientY - startY));
          x = appWin.pos.x + (e.clientX - startX);
        } else if (dir === 'e') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth + (e.clientX - startX));
        } else if (dir === 'w') {
          width = Math.max(CONFIG.MIN_SIZE.width, startWidth - (e.clientX - startX));
          x = appWin.pos.x + (e.clientX - startX);
        } else if (dir === 's') {
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight + (e.clientY - startY));
        } else if (dir === 'n') {
          height = Math.max(CONFIG.MIN_SIZE.height, startHeight - (e.clientY - startY));
          y = appWin.pos.y + (e.clientY - startY);
        }

        x = clamp(x, 0, desktop.width - width);
        y = clamp(y, CONFIG.TOOLBAR_HEIGHT, desktop.height - height - CONFIG.TASKBAR_HEIGHT);

        updateWindow(appWin.id, { pos: { x, y }, size: { width, height } });
      }
    };

    const handleMouseUp = () => {
      setDragState(prev => ({ ...prev, isActive: false }));
      setResizeState(prev => ({ ...prev, isActive: false }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isActive, resizeState.isActive, appWin.isMinimized, appWin.id, appWin.pos, appWin.size, windows, updateWindow]);

  if (appWin.isMinimized) return null;

  const startDrag = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      isActive: true,
      startX: e.clientX - appWin.pos.x,
      startY: e.clientY - appWin.pos.y
    });
    bringWindowToFront(appWin.id);
  };

  const startResize = (e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeState({
      isActive: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: appWin.size.width,
      startHeight: appWin.size.height,
      dir
    });
    bringWindowToFront(appWin.id);
  };

  const renderContent = () => {
    switch (appWin.appType) {
      case 'notepad': return <Notepad />;
      case 'video': return <Video />;
      case 'browser': return <Browser />;
      default: return <div className="window-content-default">No content available</div>;
    }
  };

  return (
    <div
      className="window"
      style={{
        left: appWin.pos.x,
        top: appWin.pos.y,
        width: appWin.size.width,
        height: appWin.size.height,
        zIndex: appWin.zIndex || CONFIG.DEFAULT_WINDOW.BASE_Z_INDEX
      }}
      onMouseDown={() => bringWindowToFront(appWin.id)}
    >
      <div className="window-header" onMouseDown={startDrag}>
        <WindowTitle appWin={appWin} updateWindow={updateWindow} bringWindowToFront={bringWindowToFront} />
        <WindowControls
          appWin={appWin}
          minimize={() => updateWindow(appWin.id, { isMinimized: true, isMaximized: false })}
          maximize={() => maximizeWindow(appWin.id)}
          close={() => closeWindow(appWin.id)}
        />
      </div>
      <div className="window-content">{renderContent()}</div>
      <ResizeHandles startResize={startResize} />
    </div>
  );
};

const FloatingBar = ({ onSelect, onClose, toolbarRef }) => {
  const [position, setPosition] = useState({ x: 0, y: 40 });

  useEffect(() => {
    if (toolbarRef.current) {
      const addButton = toolbarRef.current.querySelector('.add-icon');
      
    }
  }, [toolbarRef]);

  const apps = [
    { type: 'notepad', label: 'Notepad', icon: '📝' },
    { type: 'video', label: 'Video', icon: '🎥' },
    { type: 'browser', label: 'Browser', icon: '🌐' }
  ];

  return (
    <div
      className="floating-bar"
      style={{ left: position.x, top: position.y }}
    >
      {apps.map(app => (
        <button
          key={app.type}
          className="floating-bar-item"
          onClick={() => {
            onSelect(app.type);
            onClose();
          }}
        >
          <span className="floating-bar-icon">{app.icon}</span>
          {app.label}
        </button>
      ))}
    </div>
  );
};

export {
  AppWindow,
  FloatingBar,
  WindowTitle,
  WindowControls
}
