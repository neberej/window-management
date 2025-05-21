
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import CONFIG from './config';

// Notepad Component
const Notepad = () => (
  <div
    className="notepad-content content-box"
    contentEditable
    spellCheck={false}
    placeholder={CONFIG.NOTEPAD_PLACEHOLDER}
  />
);

// Browser Component
const Browser = () => {
  const [url, setUrl] = useState(CONFIG.DEFAULT_BROWSER_URL);
  const [iframeSrc, setIframeSrc] = useState(CONFIG.DEFAULT_BROWSER_URL);

  const handleGo = () => setIframeSrc(url);
  const handleKeyDown = e => e.key === 'Enter' && handleGo();

  return (
    <div className="browser-content content-box">
      <div className="browser-bar">
        <input
          type="text"
          className="browser-input"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL"
        />
        <button className="browser-go-btn" onClick={handleGo}>
          Go
        </button>
      </div>
      <iframe
        className="browser-iframe"
        src={iframeSrc}
        title="Browser"
      />
    </div>
  );
};

// Video Component
const Video = () => (
  <div className="video-content content-box">
    <video className="video-player" controls>
      <source src={CONFIG.DEFAULT_VIDEO_URL} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
);


export {
  Notepad,
  Browser,
  Video
}
