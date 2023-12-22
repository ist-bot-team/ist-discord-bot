{ lib, buildNpmPackage, typescript, nodePackages, prisma-engines, openssl, ... }:
buildNpmPackage rec {
  pname = "ist-discord-bot";
  version = "2.8.4";

  src = lib.cleanSource ./.;


  PRISMA_MIGRATION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/migration-engine";
  PRISMA_SCHEMA_ENGINE_BINARY = "${prisma-engines}/bin/schema-engine";
  PRISMA_QUERY_ENGINE_BINARY = "${prisma-engines}/bin/query-engine";
  PRISMA_INTROSPECTION_ENGINE_BINARY = "${prisma-engines}/bin/introspection-engine";
  PRISMA_FMT_BINARY = "${prisma-engines}/bin/prisma-fmt";

  PRISMA_SKIP_POSTINSTALL_GENERATE = 1;
  PRISMA_GENERATE_SKIP_AUTOINSTALL = 1;
  PRISMA_CLI_QUERY_ENGINE_TYPE = "binary";
  PRISMA_CLIENT_ENGINE_TYPE = "binary";


  npmDepsHash = "sha256-GtacSNGPLBd+8YpPJwIVRjffPFTMjSaVoCNVVAm2Zmo=";

  dontNpmBuild = true;

  buildInputs = [
    openssl
  ];

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


