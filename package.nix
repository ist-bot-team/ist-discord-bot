{ lib, buildNpmPackage, typescript, nodePackages, ... }:
buildNpmPackage rec {
  pname = "ist-discord-bot";
  version = "2.8.4";

  src = lib.cleanSource ./.;


  PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
  PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
  PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
  PRISMA_INTROSPECTION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/introspection-engine";
  PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";

  # npmDepsHash = lib.fakeHash;
  npmDepsHash = "sha256-TACCzj+LlSDpK/3mcdPFMPX9IliQOK9zIHknqpCJeS4=";

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


