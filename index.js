
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import Seo from "@section/Seo"
import { AppWindow, FloatingBar, WindowTitle, WindowControls } from './component';
import CONFIG from './config';
import './grid.scss';
import './grid2.scss';

// Window Management Context
const WindowContext = createContext();

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

// Desktop Component
const Desktop = () => {
  const [windows, setWindows] = useState([]);
  const [isFloatingBarOpen, setIsFloatingBarOpen] = useState(false);
  const desktopRef = useRef(null);
  const toolbarRef = useRef(null);

  // Load saved session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (saved) setWindows(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, []);

  const addWindow = appType => {
    const id = Date.now();
    setWindows(prev => [
      ...prev,
      {
        id,
        pos: { x: 50 + prev.length * CONFIG.DEFAULT_WINDOW.OFFSET_STEP, y: 50 + prev.length * CONFIG.DEFAULT_WINDOW.OFFSET_STEP },
        size: { width: CONFIG.DEFAULT_WINDOW.WIDTH, height: CONFIG.DEFAULT_WINDOW.HEIGHT },
        prevSize: { width: CONFIG.DEFAULT_WINDOW.WIDTH, height: CONFIG.DEFAULT_WINDOW.HEIGHT },
        prevPos: { x: 50 + prev.length * CONFIG.DEFAULT_WINDOW.OFFSET_STEP, y: 50 + prev.length * CONFIG.DEFAULT_WINDOW.OFFSET_STEP },
        isMinimized: false,
        isMaximized: false,
        title: `${appType.charAt(0).toUpperCase() + appType.slice(1)} ${prev.length + 1}`,
        appType,
        zIndex: Math.max(...prev.map(w => w.zIndex || CONFIG.DEFAULT_WINDOW.BASE_Z_INDEX), CONFIG.DEFAULT_WINDOW.BASE_Z_INDEX) + 1
      }
    ]);
  };

  const closeWindow = id => setWindows(prev => prev.filter(w => w.id !== id));

  const updateWindow = (id, updates) => setWindows(prev => updateWindowState(prev, id, updates));

  const maximizeWindow = id => {
    const desktop = desktopRef.current.getBoundingClientRect();
    setWindows(prev => maximizeWindowState(prev, id, desktop));
  };

  const toggleWindow = id => setWindows(prev => toggleWindowState(prev, id));

  const bringWindowToFront = id => setWindows(prev => bringToFront(prev, id));

  const saveSession = () => {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(windows));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    setWindows([]);
  };

  return (
    <WindowContext.Provider value={{
      windows,
      updateWindow,
      closeWindow,
      maximizeWindow,
      toggleWindow,
      bringWindowToFront
    }}>
      <Seo page="demo-grid"/>
      <div className="desktop" ref={desktopRef}>
        <div className="toolbar" ref={toolbarRef}>
          <button className="add-icon" onClick={() => setIsFloatingBarOpen(prev => !prev)} title="Add Window" />
          <button className="save-icon" onClick={saveSession} title="Save Session" />
          <button className="delete-icon" onClick={clearSession} title="Clear Session" />
          {isFloatingBarOpen && (
            <FloatingBar
              onSelect={addWindow}
              onClose={() => setIsFloatingBarOpen(false)}
              toolbarRef={toolbarRef}
            />
          )}
        </div>
        {windows.map(win => (
          <AppWindow key={win.id} appWin={win} context={WindowContext}/>
        ))}
        <div className="taskbar">
          {!windows.length && <span>Click on + to add a window.</span>}
          <div className="taskbar-items">
            {windows.map(win => (
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