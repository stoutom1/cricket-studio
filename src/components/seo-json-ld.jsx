export default function SeoJsonLd({
  data,
}) {
  if (!data) {
    return null;
  }

  const json =
    JSON.stringify(data).replace(
      /</g,
      "\\u003c"
    );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: json,
      }}
    />
  );
}
