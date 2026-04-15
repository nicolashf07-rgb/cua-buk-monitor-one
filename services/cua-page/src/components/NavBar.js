'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/nueva-sap', label: 'Nueva SAP' },
  { href: '/nueva-nosap', label: 'Nueva NoSAP' },
  { href: '/nueva-honorario', label: 'Nuevo Honorario' },
  { href: '/historico', label: 'Historico' },
];

export default function NavBar({ userEmail }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <nav className="bg-blue-800 dark:bg-gray-900 border-b border-blue-900 dark:border-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="text-white font-bold text-lg whitespace-nowrap">
            CUA-BUK Monitor One
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-blue-900 dark:bg-blue-900 text-white'
                    : 'text-blue-100 hover:bg-blue-700 dark:hover:bg-gray-800 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop user */}
          <div className="hidden md:flex items-center space-x-3">
            <ThemeToggle />
            {userEmail && (
              <span className="text-blue-200 dark:text-gray-400 text-sm">{userEmail}</span>
            )}
            <button
              onClick={handleLogout}
              className="bg-blue-900 dark:bg-gray-800 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-950 dark:hover:bg-gray-700 transition-colors"
            >
              Cerrar Sesion
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-2 rounded-md hover:bg-blue-700 dark:hover:bg-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-blue-900 dark:bg-gray-950 border-t border-blue-800 dark:border-gray-800">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === link.href
                    ? 'bg-blue-950 dark:bg-gray-800 text-white'
                    : 'text-blue-100 dark:text-gray-300 hover:bg-blue-800 dark:hover:bg-gray-800 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-blue-800 dark:border-gray-700">
              <div className="px-3 mb-2">
                <ThemeToggle />
              </div>
              {userEmail && (
                <p className="text-blue-200 dark:text-gray-400 text-sm px-3 mb-2">{userEmail}</p>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-red-300 hover:text-white hover:bg-blue-800 dark:hover:bg-gray-800 rounded-md text-sm font-medium"
              >
                Cerrar Sesion
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
