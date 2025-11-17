// Set CESIUM_BASE_URL before any import/use of Cesium modules
;(window as any).CESIUM_BASE_URL = import.meta.env.VITE_CESIUM_BASE_URL || '/cesium';

// If you want to use Cesium Ion services (terrain, assets), set the token here
// This import is safe because CESIUM_BASE_URL is set above
import { Ion } from 'cesium';
// Vite may reject deep imports like 'cesium/Widgets/widgets.css' because of package
// exports; import the file via the Build path instead so Vite can resolve it.
import 'cesium/Build/Cesium/Widgets/widgets.css';

const _ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
if (_ionToken && _ionToken.length > 0) {
  Ion.defaultAccessToken = _ionToken;
} else {
  // Don't set an empty token to avoid unnecessary Ion requests that return 401.
  // If you need Ion services (terrain, Cesium World Imagery, uploaded assets),
  // set VITE_CESIUM_ION_TOKEN in your `.env` file with a valid token from https://cesium.com/ion
  // Example .env:
  // VITE_CESIUM_BASE_URL=/cesium
  // VITE_CESIUM_ION_TOKEN=your_real_ion_token_here
  // After editing .env restart the dev server.
  // Log info to help debug 401 INVALID_TOKEN errors.
  // eslint-disable-next-line no-console
  console.info('No Cesium Ion token provided; Ion services will be disabled.')
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 在控制台运行
console.log('scene.mode =', window.viewer && window.viewer.scene.mode)

