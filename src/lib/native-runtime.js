import { Capacitor } from "@capacitor/core";

export function getNativeRuntime() {
  const native = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  return {
    native,
    platform,
    isIOS: native && platform === "ios",
    isAndroid: native && platform === "android",
    isWeb: !native || platform === "web",
  };
}

export function isNativeIOS() {
  return getNativeRuntime().isIOS;
}

export function isNativeAndroid() {
  return getNativeRuntime().isAndroid;
}
