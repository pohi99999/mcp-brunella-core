import React from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayChat } from './OverlayChat';
// Import global styles to be injected into Shadow DOM
import styles from '../index.css?inline';

function initOverlay() {
  const containerId = 'brunella-robotkez-overlay';
  
  // Prevent multiple injections
  if (document.getElementById(containerId)) {
    return;
  }

  // Create host container
  const host = document.createElement('div');
  host.id = containerId;
  // Make sure the host itself doesn't interfere with the page layout
  host.style.position = 'fixed';
  host.style.bottom = '20px';
  host.style.right = '20px';
  host.style.zIndex = '2147483647'; // Max z-index
  host.style.pointerEvents = 'none'; // Let clicks pass through the host container itself
  document.body.appendChild(host);

  // Attach Shadow DOM
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject Tailwind/Global CSS into Shadow DOM
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  shadowRoot.appendChild(styleElement);

  // Create a container inside the Shadow DOM for React to render into
  const rootElement = document.createElement('div');
  // Re-enable pointer events for the actual React content inside Shadow DOM
  rootElement.style.pointerEvents = 'auto'; 
  shadowRoot.appendChild(rootElement);

  // Render React App
  const root = createRoot(rootElement);
  root.render(<OverlayChat />);
}

// Auto-initialize when the script loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initOverlay();
} else {
  document.addEventListener('DOMContentLoaded', initOverlay);
}
