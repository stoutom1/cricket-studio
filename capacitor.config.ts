import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cricketstudio.app",
  appName: "Cricket Studio",
  webDir: "www",

  server: {
    url: "https://cric4all.app",
    cleartext: false,
  },
};

export default config;