import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/utils/api';
import { setAuthToken, setAuthUser } from '@/utils/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PrimaryButton } from '@/components/shared/Buttons';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      const { access_token, user } = response.data;

      setAuthToken(access_token);
      setAuthUser(user);

      toast.success(`Добро пожаловать, ${user.full_name}!`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1765279077820-d3f4f2bcdca5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHw0fHxtb2Rlcm4lMjBvZmZpY2UlMjBidWlsZGluZyUyMGdsYXNzJTIwZmFjYWRlfGVufDB8fHx8MTc3MzQwNDM2NXww&ixlib=rb-4.1.0&q=85)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <span className="text-2xl font-bold text-white">PC</span>
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">ProcureCheck KZ</h1>
          <p className="text-slate-300 text-sm">Система аналитики госзакупок Казахстана</p>
        </div>

        <Card data-testid="login-card" className="backdrop-blur-md bg-white/95">
          <CardHeader>
            <CardTitle className="text-2xl font-medium text-center">Вход в систему</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  data-testid="login-email-input"
                  id="email"
                  type="email"
                  placeholder="admin@procurecheck.kz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Пароль
                </Label>
                <Input
                  data-testid="login-password-input"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10"
                />
              </div>

              <PrimaryButton
                data-testid="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base"
              >
                {loading ? (
                  <span>Загрузка...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" strokeWidth={1.5} />
                    Войти
                  </>
                )}
              </PrimaryButton>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-2">Демо учетные записи:</p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>admin@procurecheck.kz / demo123 (Администратор)</p>
                <p>analyst@procurecheck.kz / demo123 (Аналитик)</p>
                <p>viewer@procurecheck.kz / demo123 (Просмотрщик)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
