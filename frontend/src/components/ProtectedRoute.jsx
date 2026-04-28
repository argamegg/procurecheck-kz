import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthUser, isAuthenticated } from '@/utils/auth';

export const ProtectedRoute = ({ children, roles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length) {
    const user = getAuthUser();
    if (!user || !roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
