import React from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { FaWifi, FaExclamationTriangle } from 'react-icons/fa';

const ConnectionStatus: React.FC = () => {
  const { isConnected } = useSocket();
  const { isAuthenticated, user, token } = useAuth();

  const getStatusColor = () => {
    if (!isAuthenticated) return 'text-warning';
    return isConnected ? 'text-success' : 'text-danger';
  };

  const getStatusText = () => {
    if (!isAuthenticated) return 'Not Authenticated';
    return isConnected ? 'Connected' : 'Disconnected';
  };

  const getStatusIcon = () => {
    if (!isAuthenticated) return <FaExclamationTriangle />;
    return isConnected ? <FaWifi /> : <FaExclamationTriangle />;
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <span className={`${getStatusColor()}`}>
        {getStatusIcon()}
      </span>
      <span className={`small ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      {isAuthenticated && (
        <div className="small text-muted">
          ({user?.role} - {token ? `${token.substring(0, 10)}...` : 'No token'})
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 