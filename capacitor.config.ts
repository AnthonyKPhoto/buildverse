import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.kaiserhomelab.buildverse",
  appName: "BuildVerse",
  // Update this URL to your BuildVerse server address.
  // Use your external domain (https://buildverse.yourdomain.com) for remote access,
  // or the LAN IP (http://192.168.x.x:3456) for local-only use.
  server: {
    url: "http://YOUR_SERVER_IP:3456",
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
