import React, { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner, Alert, Container } from 'react-bootstrap';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = memo(({ 
  children, 
  allowedRoles 
}) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3 text-muted">Loading...</p>
        </div>
      </Container>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return (
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Alert variant="danger" className="text-center" style={{ maxWidth: '500px' }}>
            <Alert.Heading>Access Denied</Alert.Heading>
            <p>
              You don't have permission to access this page. 
              Required role(s): {allowedRoles.join(', ')}
            </p>
            <p className="mb-0">
              Your current role: <strong>{user.role}</strong>
            </p>
          </Alert>
        </Container>
      );
    }
  }

  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute; 