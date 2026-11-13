cask "upshift-garage" do
  arch arm: "arm64", intel: "x64"

  version "1.16.0"
  sha256 arm:   "8164a279884a374048fe6b1249fa8cdd8117fcbb9e4b24bbbad05f4477382133",
         intel: "a2262be3b9ceeac13e6ee512234a23b989a5dbbfd7453cee979b1ce5ebc58fdc"

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
