// Define the environment interface
interface Environment {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

// Declare the global window object with our environment
declare global {
  interface Window {
    __ENV__?: Environment;
  }
}

// Configuration object that reads from multiple sources
export const config = {
  firebase: {
    apiKey: 
      window.__ENV__?.VITE_FIREBASE_API_KEY ||
      import.meta.env.VITE_FIREBASE_API_KEY ||
      '',
    
    authDomain: 
      window.__ENV__?.VITE_FIREBASE_AUTH_DOMAIN ||
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
      '',
    
    projectId: 
      window.__ENV__?.VITE_FIREBASE_PROJECT_ID ||
      import.meta.env.VITE_FIREBASE_PROJECT_ID ||
      '',
    
    storageBucket: 
      window.__ENV__?.VITE_FIREBASE_STORAGE_BUCKET ||
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      '',
    
    messagingSenderId: 
      window.__ENV__?.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      '',
    
    appId: 
      window.__ENV__?.VITE_FIREBASE_APP_ID ||
      import.meta.env.VITE_FIREBASE_APP_ID ||
      ''
  }
};

// Validation function
export function validateConfig() {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missing = required.filter(key => !config.firebase[key as keyof typeof config.firebase]);
  
  if (missing.length > 0) {
    console.error('Missing Firebase configuration:', missing);
    return false;
  }
  
  return true;
}
