import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { clamp, snapToEdges } from '@utils/demo/gridUtil';
import config from './config';
import './grid.scss';
import './icons.scss';

const { SNAP_THRESHOLD, MIN_SIZE, TOOLBAR_HEIGHT, TASKBAR_HEIGHT, STORAGE_KEY } = config;

const WindowContext = createContext();

// Utility function to update window state
const updateWindowState = (windows, id, updates) =>
  windows.map((w) => (w.id === id ? { ...w, ...updates } : w));

// Utility function to toggle window visibility
const toggleWindowState = (windows, id) =>
  windows.map((w) =>
    w.id === id
      ? {
          ...w,
          isMinimized: !w.isMinimized,
          isMaximized: !w.isMinimized ? false : w.isMaximized,
          pos: { x: w.pos.x, y: Math.max(TOOLBAR_HEIGHT, w.pos.y) },
        }
      : w
  );

const maximizeWindowState = (windows, id, desktopRect) =>
  windows.map((w) => {
    if (w.id !== id) return { ...w, isMinimized: true };
    if (w.isMaximized) {
      return {
        ...w,
        pos: w.prevPos,
        size: w.prevSize,
        isMinimized: false,
        isMaximized: false,
      };
    }
    return {
      ...w,
      prevPos: { ...w.pos },
      prevSize: { ...w.size },
      pos: { x: 0, y: TOOLBAR_HEIGHT },
      size: { width: desktopRect.width, height: desktopRect.height - TOOLBAR_HEIGHT - TASKBAR_HEIGHT },
      isMinimized: false,
      isMaximized: true,
    };
  });

const ResizeHandles = ({ startResize }) => {
  const directions = ['ne', 'nw', 'se', 'sw', 'n', 's', 'e', 'w'];
  return directions.map((dir) => (
    <div
      key={dir}
      className={`resize-handle ${dir}`}
      onMouseDown={(e) => startResize(e, dir)}
    />
  ));
};

// Window component - draggable/resizable
const AppWindow = ({ appWin }) => {
  const { updateWindow, closeWindow, maximizeWindow, windows } = useContext(WindowContext);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [dragState, setDragState] = useState({ isActive: false, startX: 0, startY: 0 });
  const [resizeState, setResizeState] = useState({
    isActive: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    dir: '',
  });

  useEffect(() => {
    if (appWin.isMinimized || (!dragState.isActive && !resizeState.isActive)) {
      return;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isActive, resizeState.isActive, appWin.isMinimized]);

  // Don't render the window if it's minimized
  if (appWin.isMinimized) return null;

  const updatePosition = (clientX, clientY) => {
    const desktop = document.querySelector('.desktop').getBoundingClientRect();
    let x = clientX - dragState.startX;
    let y = clientY - dragState.startY;

    ({ x, y } = snapToEdges({ x, y }, appWin.size, windows, appWin.id, SNAP_THRESHOLD));
    x = clamp(x, 0, desktop.width - appWin.size.width);
    y = clamp(y, TOOLBAR_HEIGHT, desktop.height - appWin.size.height - TASKBAR_HEIGHT);

    updateWindow(appWin.id, { pos: { x, y } });
  };

  const updateSize = (clientX, clientY) => {
    let { width, height } = appWin.size;
    let { x, y } = appWin.pos;
    const { dir, startX, startY, startWidth, startHeight } = resizeState;

    if (dir.includes('e')) width = Math.max(MIN_SIZE.width, startWidth + (clientX - startX));
    if (dir.includes('w')) {
      width = Math.max(MIN_SIZE.width, startWidth - (clientX - startX));
      x = appWin.pos.x + (clientX - startX);
    }
    if (dir.includes('s')) height = Math.max(MIN_SIZE.height, startHeight + (clientY - startY));
    if (dir.includes('n')) {
      height = Math.max(MIN_SIZE.height, startHeight - (clientY - startY));
      y = appWin.pos.y + (clientY - startY);
    }

    updateWindow(appWin.id, { pos: { x, y }, size: { width, height } });
  };

  const handleMouseMove = (e) => {
    if (dragState.isActive) updatePosition(e.clientX, e.clientY);
    else if (resizeState.isActive) updateSize(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setDragState((prev) => ({ ...prev, isActive: false }));
    setResizeState((prev) => ({ ...prev, isActive: false }));
  };

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      isActive: true,
      startX: e.clientX - appWin.pos.x,
      startY: e.clientY - appWin.pos.y,
    });
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
      dir,
    });
  };

  const minimize = () => updateWindow(appWin.id, { isMinimized: true, isMaximized: false });

  const updateTitle = (e) => updateWindow(appWin.id, { title: e.target.value });

  const saveTitle = (e) => e.key === 'Enter' && setIsEditingTitle(false);

  return (
    <div
      className="window"
      style={{
        left: appWin.pos.x,
        top: appWin.pos.y,
        width: appWin.size.width,
        height: appWin.size.height,
        zIndex: appWin.id + 100,
      }}
    >
      <div className="window-header" onMouseDown={startDrag}>
        <div className="window-title">
          {isEditingTitle ? (
            <input
              className="title-input"
              value={appWin.title}
              onChange={updateTitle}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={saveTitle}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <>
              {appWin.title}
              <span className="pencil-icon" onClick={() => setIsEditingTitle(true)}>&#9998;</span>
            </>
          )}
        </div>
        <div className="window-controls">
          <span className="minimize-btn" onClick={minimize}>
            –
          </span>
          <span className="maximize-btn" onClick={() => maximizeWindow(appWin.id)}>
            □
          </span>
          <span className="close-btn" onClick={() => closeWindow(appWin.id)}>
            ×
          </span>
        </div>
      </div>
      <div className="window-content" />
      <ResizeHandles startResize={startResize} />
    </div>
  );
};

// Desktop component managing windows and session
const Desktop = () => {
  const [windows, setWindows] = useState([]);
  const desktopRef = useRef(null);

  useEffect(() => {
    loadSession();
  }, []);

  const addWindow = () => {
    const id = Date.now();
    setWindows((prev) => [
      ...prev,
      {
        id,
        pos: { x: 50 + prev.length * 20, y: 50 + prev.length * 20 },
        size: { width: 200, height: 150 },
        prevSize: { width: 200, height: 150 },
        prevPos: { x: 50 + prev.length * 20, y: 50 + prev.length * 20 },
        isMinimized: false,
        isMaximized: false,
        title: `Window ${prev.length + 1}`,
      },
    ]);
  };

  const closeWindow = (id) => setWindows((prev) => prev.filter((w) => w.id !== id));

  const updateWindow = (id, updates) =>
    setWindows((prev) => updateWindowState(prev, id, updates));

  const maximizeWindow = (id) => {
    const desktop = desktopRef.current.getBoundingClientRect();
    setWindows((prev) => maximizeWindowState(prev, id, desktop));
  };

  const toggleWindow = (id) => setWindows((prev) => toggleWindowState(prev, id));

  const saveSession = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const loadSession = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setWindows(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setWindows([]);
  };

  const contextValue = {
    windows,
    updateWindow,
    closeWindow,
    maximizeWindow,
    toggleWindow,
  };

  return (
    <WindowContext.Provider value={contextValue}>
      <div className="desktop" ref={desktopRef}>
        <div className="toolbar">
          <button className="add-icon" onClick={addWindow} title="Add Window"></button>
          <button className="save-icon" onClick={saveSession} title="Save Session"></button>
          <button
            className="delete-icon"
            onClick={clearSession}
            title="Clear Session"
          ></button>
        </div>
        {windows.map((win) => (
          <AppWindow key={win.id} appWin={win} />
        ))}
        <div className="taskbar">
          {!windows.length && <span>Click on + to add a window.</span>}
          <div className="taskbar-items">
            {windows.map((win) => (
              <div
                key={win.id}
                className={`taskbar-item ${win.isMinimized ? 'minimized' : ''}`}
                onClick={() => toggleWindow(win.id)}
              >
                {win.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </WindowContext.Provider>
  );
};

export default Desktop;