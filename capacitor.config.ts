import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.angelsteakhouse.mobile",
  appName: "Restaurant POS",
  webDir: "dist",
  server: { androidScheme: "https" },
  ios: {
    contentInset: "never",
    scrollEnabled: false,
    zoomEnabled: false,
    backgroundColor: "#f3f5f4",
  },
  plugins: { CapacitorHttp: { enabled: true } },
};
export default config;
