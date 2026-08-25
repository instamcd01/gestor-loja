import type { CapacitorConfig } from '@capacitor/cli';

// O site é SSR (auth por cookie, pagamento via Mercado Pago/Pix) — não dá
// pra empacotar um build estático. O app nativo carrega a URL de produção
// real dentro do WebView, funcionando como uma casca (shell) em volta do
// site já em produção.
const config: CapacitorConfig = {
  appId: 'br.com.deliverypetexpress.app',
  appName: 'Delivery Pet',
  webDir: 'public',
  server: {
    url: 'https://deliverypetexpress.com.br',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#2C9FE0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
