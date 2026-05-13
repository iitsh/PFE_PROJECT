import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Inscription from './Screen/Page_inscription';
import Connexion from './Screen/Page_connexion';
import Dashboard from './Screen/Dashboard';
import './App.css';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/connexion" />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;