import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { LoginSuccessPage } from './pages/LoginSuccessPage';
import { IndustrySelectionPage } from './pages/IndustrySelectionPage';
import { MainPage } from './pages/MainPage';
import { GlobalAlert } from './app/components/ui/GlobalAlert';
import { useGameStore } from './store/gameStore';
import './App.css';

function BgmPlayer() {
  const bgmVolume = useGameStore(state => state.bgmVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/audio/bgm.m4a");
    audio.loop = true;
    audio.volume = bgmVolume / 100;
    audioRef.current = audio;

    const tryPlay = () => { audio.play().catch(() => {}); };
    const startOnInteraction = () => {
      tryPlay();
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };
    tryPlay();
    window.addEventListener("click", startOnInteraction);
    window.addEventListener("keydown", startOnInteraction);

    return () => {
      audio.pause();
      audio.src = "";
      window.removeEventListener("click", startOnInteraction);
      window.removeEventListener("keydown", startOnInteraction);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = bgmVolume / 100;
  }, [bgmVolume]);

  return null;
}

function App() {
  return (
    <>
      <BgmPlayer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login/success" element={<LoginSuccessPage />} />
          <Route path="/industry-selection" element={<IndustrySelectionPage />} />
          <Route path="/main" element={<MainPage />} />
        </Routes>
      </BrowserRouter>
      <GlobalAlert />
    </>
  );
}

export default App;
