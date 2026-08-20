import OfflinePageClient from "@/components/offline-page-client";

export const metadata = {
  title: "Offline | Cric4All",
  description:
    "Resume Cric4All scoring when connectivity is unavailable.",
};

export default function OfflinePage() {
  return (
    <OfflinePageClient />
  );
}
