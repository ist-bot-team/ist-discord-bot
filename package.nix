{ self, lib, buildNpmPackage, fetchFromGitHub, typescript, nodePackages, ... }:
buildNpmPackage rec {
  pname = "ist-discord-bot";
  version = "2.8.4";

  src = ./.;

  #  npmDepsHash = lib.fakeHash;
  npmDepsHash = "sha256-8jeNHGTbUVksyYy1zmhDzoDnwVo0GUFtCifni1iBbg8=";
  # npmDepsHash = "sha256-YKw64xtwJWU4EwdTfiHTisxiy8qVhWfd68zfIy1C+ek=";

  dontNpmBuild = true;
  #preBuildPhase = ''
  #  ${nodePackages.prisma}/bin/prisma generate
 # '';

  configurePhase = ''
      ${nodePackages.prisma}/bin/prisma generate
  '';
  
  buildPhase = ''
    ${typescript}/bin/tsc;
 '';

  postBuildPhase = ''
    set -exu
    export DEBUG=1
    tmpdir=$(mktemp -d)
    echo $tmpdir
    mv $out/dist $tmpdir/
    rm -rf $out/*
    mv $tmpdir/dist $out/
  '';


  meta = with lib; {
    # description = "A modern web UI for various torrent clients with a Node.js backend and React frontend";
    # homepage = "https://flood.js.org";
    # license = licenses.gpl3Only;
    # maintainers = with maintainers; [ winter ];
  };
}


