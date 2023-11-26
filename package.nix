{ self, lib, buildNpmPackage, fetchFromGitHub, ... }:
buildNpmPackage rec {
  pname = "ist-discord-bot";
  version = "2.8.3";

  src = self;
  npmDepsHash = "sha256-raYtJfRRLNXWWqNnk11FEm9aAGSlvybDTgB7msRq5gI=";

  # The prepack script runs the build script, which we'd rather do in the build phase.
  # npmPackFlags = [ "--ignore-scripts" ];

  # NODE_OPTIONS = "--openssl-legacy-provider";

  meta = with lib; {
    # description = "A modern web UI for various torrent clients with a Node.js backend and React frontend";
    # homepage = "https://flood.js.org";
    # license = licenses.gpl3Only;
    # maintainers = with maintainers; [ winter ];
  };
}


