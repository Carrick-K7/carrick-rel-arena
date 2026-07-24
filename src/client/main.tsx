import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
const appRoot: HTMLElement = root;

async function waitForProductFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(
      '400 16px "Relationship Display"',
      '练习那些让彼此更靠近的回应 012345678',
    ),
    document.fonts.load('400 16px "Relationship Sans"', '关系修炼'),
    document.fonts.load('700 16px "Relationship Sans"', '关系修炼'),
    document.fonts.load('400 16px "Relationship Serif"', '关系修炼'),
    document.fonts.load('600 16px "Relationship Serif"', '关系修炼'),
  ]);
  await document.fonts.ready;
}

async function bootstrap(): Promise<void> {
  try {
    await waitForProductFonts();
    document.documentElement.dataset.fontsReady = 'true';
  } catch {
    document.documentElement.dataset.fontsReady = 'fallback';
  }

  createRoot(appRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
