'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSuccess = () => {
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 dark:from-gray-950 to-white dark:to-gray-900 px-4">
      <LoginForm onSuccess={handleSuccess} />
    </div>
  );
}
