import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import SearchResults from '@/pages/SearchResults';
import SupplierProfile from '@/pages/SupplierProfile';
import CompaniesCatalog from '@/pages/CompaniesCatalog';
import RnuRegistry from '@/pages/RnuRegistry';
import ProtectedRoute from '@/components/ProtectedRoute';
import '@/App.css';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplier/:bin"
            element={
              <ProtectedRoute>
                <SupplierProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <CompaniesCatalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rnu"
            element={
              <ProtectedRoute>
                <RnuRegistry />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}

export default App;
