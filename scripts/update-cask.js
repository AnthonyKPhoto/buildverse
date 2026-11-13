#!/usr/bin/env node
// Writes Casks/upshift-garage.rb for a given version.
//   node scripts/update-cask.js <version> <arm64-sha256> <x64-sha256>
// Used by the release workflow (update-cask job); can also be run by hand.
const fs = require("fs");
const path = require("path");
const [version, arm, intel] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || "") || !/^[0-9a-f]{64}$/.test(arm || "") || !/^[0-9a-f]{64}$/.test(intel || "")) {
  console.error("usage: update-cask.js <x.y.z> <arm64-sha256> <x64-sha256>");
  process.exit(1);
}
const cask = `cask "upshift-garage" do
  arch arm: "arm64", intel: "x64"

  version "${version}"
  sha256 arm:   "${arm}",
         intel: "${intel}"

  url "https://github.com/AnthonyKPhoto/buildverse/releases/download/v#{version}/UpshiftGarage-#{version}-mac-#{arch}.dmg"
  name "Upshift Garage"
  desc "Plan, track and budget your car build — local-first vehicle modification manager"
  homepage "https://github.com/AnthonyKPhoto/buildverse"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Upshift Garage.app"

  # The app is ad-hoc signed, not notarized (that needs a paid Apple Developer
  # account). Clearing the quarantine flag lets it open without the Gatekeeper block.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/Upshift Garage.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/BuildVerse",
    "~/Library/Preferences/com.buildverse.app.plist",
    "~/Library/Saved Application State/com.buildverse.app.savedState",
  ]
end
`;
fs.writeFileSync(path.join(__dirname, "..", "Casks", "upshift-garage.rb"), cask);
console.log(`Casks/upshift-garage.rb → ${version}`);
