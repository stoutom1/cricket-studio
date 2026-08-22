import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, relativePath),
      "utf8"
    )
  );
}

function readText(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8"
  );
}

function exists(relativePath) {
  return fs.existsSync(
    path.join(root, relativePath)
  );
}

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
  if (condition) {
    pass(ok);
  } else {
    fail(bad);
  }
}

console.log("");
console.log("Cric4All iOS Release Readiness Check");
console.log("====================================");
console.log("");

const capacitor = readJson(
  "capacitor.config.json"
);

check(
  capacitor.appId === "com.cric4all.app",
  "Bundle/Application ID is com.cric4all.app",
  `Expected appId com.cric4all.app, found ${capacitor.appId || "(missing)"}`
);

check(
  capacitor.appName === "Cric4All",
  "App name is Cric4All",
  `Expected appName Cric4All, found ${capacitor.appName || "(missing)"}`
);

check(
  capacitor.webDir === "public",
  "Capacitor webDir is public",
  `Expected webDir public, found ${capacitor.webDir || "(missing)"}`
);

check(
  capacitor?.server?.url === "https://cric4all.app",
  "Production server URL is https://cric4all.app",
  `Expected server.url https://cric4all.app, found ${capacitor?.server?.url || "(missing)"}`
);

check(
  capacitor?.server?.cleartext === false,
  "Cleartext HTTP is disabled",
  "Capacitor cleartext should be false"
);

check(
  capacitor?.ios?.preferredContentMode === "mobile",
  "iOS preferred content mode is mobile",
  "iOS preferredContentMode should be mobile"
);

check(
  capacitor?.ios?.webContentsDebuggingEnabled === false,
  "iOS production WebView debugging is disabled",
  "iOS webContentsDebuggingEnabled should be false before release"
);

const packageJson = readJson(
  "package.json"
);

const requiredCapacitorPackages = [
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/core",
  "@capacitor/ios",
  "@capacitor/network",
  "@capacitor/push-notifications",
  "@capacitor/share",
];

for (const dependency of requiredCapacitorPackages) {
  check(
    Boolean(
      packageJson.dependencies?.[dependency]
    ),
    `${dependency} is installed`,
    `${dependency} is missing from dependencies`
  );
}

check(
  exists("ios/App/App.xcodeproj/project.pbxproj"),
  "iOS Xcode project exists",
  "ios/App/App.xcodeproj/project.pbxproj is missing"
);

if (
  exists("ios/App/App.xcodeproj/project.pbxproj")
) {
  const pbx =
    readText(
      "ios/App/App.xcodeproj/project.pbxproj"
    );

  check(
    pbx.includes(
      "PRODUCT_BUNDLE_IDENTIFIER = com.cric4all.app;"
    ),
    "Xcode bundle identifier is com.cric4all.app",
    "Xcode project does not contain PRODUCT_BUNDLE_IDENTIFIER = com.cric4all.app"
  );

  check(
    !pbx.includes(
      'TARGETED_DEVICE_FAMILY = "1,2";'
    ) &&
      pbx.includes(
        "TARGETED_DEVICE_FAMILY = 1;"
      ),
    "Initial native target is iPhone-only",
    'Expected TARGETED_DEVICE_FAMILY = 1; for the initial iPhone-only release'
  );

  const marketingVersions =
    [
      ...pbx.matchAll(
        /MARKETING_VERSION = ([^;]+);/g
      ),
    ].map(
      (match) =>
        match[1].trim()
    );

  const buildVersions =
    [
      ...pbx.matchAll(
        /CURRENT_PROJECT_VERSION = ([^;]+);/g
      ),
    ].map(
      (match) =>
        match[1].trim()
    );

  if (marketingVersions.length) {
    pass(
      `Marketing version(s): ${[
        ...new Set(marketingVersions),
      ].join(", ")}`
    );
  } else {
    warn(
      "Could not find MARKETING_VERSION in project.pbxproj"
    );
  }

  if (buildVersions.length) {
    pass(
      `Build number(s): ${[
        ...new Set(buildVersions),
      ].join(", ")}`
    );
  } else {
    warn(
      "Could not find CURRENT_PROJECT_VERSION in project.pbxproj"
    );
  }
}

check(
  exists("ios/App/App/Info.plist"),
  "Info.plist exists",
  "ios/App/App/Info.plist is missing"
);

check(
  exists("ios/App/App/Assets.xcassets"),
  "iOS asset catalog exists",
  "ios/App/App/Assets.xcassets is missing"
);

check(
  exists("src/app/privacy") ||
    exists("src/app/privacy/page.jsx") ||
    exists("src/app/privacy/page.js"),
  "Privacy route exists in source tree",
  "Privacy route was not found"
);

check(
  exists("src/app/delete-account") ||
    exists("src/app/delete-account/page.jsx") ||
    exists("src/app/delete-account/page.js"),
  "Account deletion route exists in source tree",
  "Account deletion route was not found"
);

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
    `Release readiness check failed with ${failures.length} issue(s).`
  );

  process.exit(1);
}

console.log("");
console.log(
  "Release configuration checks passed."
);
console.log(
  "Apple signing, APNs capability, archive validation and TestFlight still require macOS/Xcode."
);
