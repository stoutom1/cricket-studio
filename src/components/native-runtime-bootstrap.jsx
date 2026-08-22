"use client";

import { useEffect } from "react";
import { getNativeRuntime } from "@/lib/native-runtime";

export default function NativeRuntimeBootstrap() {
  useEffect(() => {
    const root = document.documentElement;
    const runtime = getNativeRuntime();

    root.classList.toggle("cric4all-native", runtime.native);
    root.classList.toggle("cric4all-ios", runtime.isIOS);
    root.classList.toggle("cric4all-android", runtime.isAndroid);
    root.classList.toggle("cric4all-web", runtime.isWeb);
    root.dataset.cric4allPlatform = runtime.platform;

    return () => {
      root.classList.remove(
        "cric4all-native",
        "cric4all-ios",
        "cric4all-android",
        "cric4all-web"
      );
      delete root.dataset.cric4allPlatform;
    };
  }, []);

  return null;
}
