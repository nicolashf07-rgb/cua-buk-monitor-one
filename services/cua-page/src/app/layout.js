import './globals.css';

export const metadata = {
  title: 'CUA-BUK Monitor One',
  description: 'Sistema de Contratacion - Clinica Universidad de los Andes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors">
        {children}
      </body>
    </html>
  );
}
