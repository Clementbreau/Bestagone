import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // loadEnv lit les .env locaux ; process.env couvre les Build Variables Cloudflare.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const env = { ...fileEnv, ...process.env };

  if (mode === 'production') {
    const missing = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ].filter((key) => !env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Build interrompu : variable(s) manquante(s) : ${missing.join(', ')}. ` +
        'Dans Cloudflare : Settings > Builds > Build Variables and Secrets.',
      );
    }
  }

  return {
    plugins: [react()],
  };
});
