import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { IndustrySelectionPage } from './pages/IndustrySelectionPage';
import { MainPage } from './pages/MainPage';
import { GlobalAlert } from './app/components/ui/GlobalAlert';
import './App.css';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/industry-selection" element={<IndustrySelectionPage />} />
          <Route path="/main" element={<MainPage />} />
        </Routes>
      </BrowserRouter>
      <GlobalAlert />
    </>
  );
}

export default App;
