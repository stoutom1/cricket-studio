"use client";

import {
  useEffect,
} from "react";
import {
  useRouter,
} from "next/navigation";

export default function LiveShareRedirect({
  href,
}) {
  const router =
    useRouter();

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            router.replace(
              href
            );
          },
          650
        );

      return () =>
        window.clearTimeout(
          timer
        );
    },
    [
      href,
      router,
    ]
  );

  return null;
}
