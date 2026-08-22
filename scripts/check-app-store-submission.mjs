import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const metadataPath = path.join(
  root,
  "release/app-store/app-store-metadata.json"
);
const notesPath = path.join(
  root,
  "release/app-store/review-notes.txt"
);

const failures = [];
const warnings = [];
const passes = [];

function pass(message) {
  passes.push(message);
}
function fail(message) {
  failures.push(message);
}
function warn(message) {
  warnings.push(message);
}
function check(condition, ok, bad) {
  condition ? pass(ok) : fail(bad);
}

console.log("");
console.log("Cric4All App Store Submission Check");
console.log("===================================");
console.log("");

check(
  fs.existsSync(metadataPath),
  "App Store metadata file exists",
  "release/app-store/app-store-metadata.json is missing"
);

check(
  fs.existsSync(notesPath),
  "App Review notes template exists",
  "release/app-store/review-notes.txt is missing"
);

if (fs.existsSync(metadataPath)) {
  const metadata = JSON.parse(
    fs.readFileSync(metadataPath, "utf8")
  );

  check(
    metadata.appName?.length >= 2 &&
      metadata.appName?.length <= 30,
    `App name length is valid (${metadata.appName?.length || 0}/30)`,
    "App name must be between 2 and 30 characters"
  );

  check(
    metadata.subtitle?.length <= 30,
    `Subtitle length is valid (${metadata.subtitle?.length || 0}/30)`,
    "Subtitle exceeds Apple's 30-character limit"
  );

  check(
    metadata.bundleId === "com.cric4all.app",
    "Bundle ID is com.cric4all.app",
    "Bundle ID mismatch"
  );

  check(
    metadata.primaryCategory === "Sports",
    "Primary category is Sports",
    "Expected Sports as primary category"
  );

  for (const field of [
    "marketingUrl",
    "privacyPolicyUrl",
    "supportUrl",
  ]) {
    try {
      const value = new URL(metadata[field]);
      check(
        value.protocol === "https:",
        `${field} uses HTTPS`,
        `${field} must use HTTPS`
      );
    } catch {
      fail(`${field} is not a valid URL`);
    }
  }

  if ((metadata.keywords || "").length > 100) {
    fail(
      `Keywords exceed 100 characters (${metadata.keywords.length})`
    );
  } else {
    pass(
      `Keywords fit within 100 characters (${(metadata.keywords || "").length}/100)`
    );
  }

  check(
    Boolean(metadata.description?.trim()),
    "Description is populated",
    "Description is empty"
  );

  check(
    metadata.version === "1.0",
    "Initial App Store version is 1.0",
    `Expected version 1.0, found ${metadata.version || "(missing)"}`
  );

  check(
    metadata.build === "1",
    "Initial App Store build is 1",
    `Expected build 1, found ${metadata.build || "(missing)"}`
  );
}

if (fs.existsSync(notesPath)) {
  const notes = fs.readFileSync(
    notesPath,
    "utf8"
  );

  if (
    notes.includes("<APPLE_REVIEW_ACCOUNT_EMAIL>") ||
    notes.includes("<APPLE_REVIEW_ACCOUNT_PASSWORD>")
  ) {
    warn(
      "Review credentials are still placeholders. Replace them only immediately before App Store submission."
    );
  } else {
    pass(
      "Review credentials placeholders have been replaced"
    );
  }
}

console.log("PASS");
console.log("----");
for (const item of passes) {
  console.log(`✓ ${item}`);
}

if (warnings.length) {
  console.log("");
  console.log("WARNINGS");
  console.log("--------");
  for (const item of warnings) {
    console.log(`! ${item}`);
  }
}

if (failures.length) {
  console.log("");
  console.log("FAILURES");
  console.log("--------");
  for (const item of failures) {
    console.log(`✗ ${item}`);
  }

  console.log("");
  console.error(
    `Submission preflight failed with ${failures.length} issue(s).`
  );
  process.exit(1);
}

console.log("");
console.log(
  "App Store submission metadata preflight passed."
);
console.log(
  "Warning items can remain until the final App Store Connect submission stage."
);
