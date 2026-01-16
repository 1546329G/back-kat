import React from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/main.css';

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = (): void => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <img 
            src="/logo.png" 
            alt="Logo CEINCO" 
            className="header-logo" 
          />
          <h1 className="header-title">CEINCO</h1>
          <span className="header-user">
            {user?.nombre} {user?.apellido} - {user?.cargo}
          </span>
        </div>
        <div className="header-right">
          <button
            onClick={handleLogout}
            className="logout-button"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;