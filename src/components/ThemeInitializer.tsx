"use client";

import { useEffect } from 'react';

const ThemeInitializer = () => {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return null; // This component does not render anything
};

export default ThemeInitializer;
