cask "upshift-garage" do
  arch arm: "arm64", intel: "x64"

  version "1.15.0"
  sha256 arm:   "2ff069459630a47e9aaf8f13dd09674b462a61d745c5fc901f8d6b297e85f06a",
         intel: "807b23fc750090f5820266603af8c670b7b0363bccc4c7c7b1c447860412a137"

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
