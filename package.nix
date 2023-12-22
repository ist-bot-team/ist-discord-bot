{ lib, buildNpmPackage, typescript, nodePackages, ... }:
buildNpmPackage rec {
  pname = "ist-discord-bot";
  version = "2.8.4";

  src = lib.cleanSource ./.;


  # npmDepsHash = lib.fakeHash;
  npmDepsHash = "sha256-GtacSNGPLBd+8YpPJwIVRjffPFTMjSaVoCNVVAm2Zmo=";

  dontNpmBuild = true;

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


