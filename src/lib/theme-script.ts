// No React here: imported by the root layout (a Server Component).

export const THEME_STORAGE_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Inline script for <head>: applies the saved theme before first paint, so the
 * page never flashes the wrong theme. Mirrors applyTheme() in theme.ts.
 */
export const themeInitScript = `try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`;
