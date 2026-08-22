"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";

function emit(name, detail = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(name, {
      detail: {
        ...detail,
        at: new Date().toISOString(),
      },
    })
  );
}

export default function NativeAppLifecycle() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let disposed = false;
    const handles = [];

    async function addHandle(promise) {
      try {
        const handle = await promise;

        if (disposed) {
          await handle?.remove?.();
          return;
        }

        handles.push(handle);
      } catch (error) {
        console.warn("[NATIVE_LIFECYCLE_LISTENER_FAILED]", error);
      }
    }

    async function initialize() {
      /*
       * Native foreground/background events supplement the browser lifecycle.
       * No scoring state is mutated here. IndexedDB/localStorage remain the
       * source of truth for Cric4All's existing offline scoring implementation.
       */
      await addHandle(
        App.addListener("appStateChange", ({ isActive }) => {
          emit(
            isActive
              ? "cric4all:native-resume"
              : "cric4all:native-pause",
            {
              platform: Capacitor.getPlatform(),
            }
          );

          if (isActive) {
            /*
             * Re-check native network state on every foreground. If iOS
             * suspended the WebView while connectivity changed, this wakes the
             * existing browser online/offline pipeline without duplicating the
             * scoring sync engine.
             */
            Network.getStatus()
              .then((status) => {
                emit("cric4all:native-network", status);

                window.dispatchEvent(
                  new Event(
                    status.connected
                      ? "online"
                      : "offline"
                  )
                );
              })
              .catch((error) => {
                console.warn(
                  "[NATIVE_NETWORK_RESUME_CHECK_FAILED]",
                  error
                );
              });
          }
        })
      );

      await addHandle(
        Network.addListener(
          "networkStatusChange",
          (status) => {
            emit("cric4all:native-network", status);

            /*
             * dashboard-client.jsx already has a mature online/offline sync
             * pipeline. Re-emit the standard browser event so native network
             * transitions use that exact same tested code path.
             */
            window.dispatchEvent(
              new Event(
                status.connected
                  ? "online"
                  : "offline"
              )
            );
          }
        )
      );

      try {
        const initialStatus =
          await Network.getStatus();

        emit(
          "cric4all:native-network",
          initialStatus
        );
      } catch (error) {
        console.warn(
          "[NATIVE_NETWORK_INITIAL_CHECK_FAILED]",
          error
        );
      }
    }

    initialize();

    return () => {
      disposed = true;

      for (const handle of handles) {
        try {
          handle?.remove?.();
        } catch {
          // Listener cleanup must never affect app navigation.
        }
      }
    };
  }, []);

  return null;
}
