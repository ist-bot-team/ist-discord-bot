{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems =
        function:
        nixpkgs.lib.genAttrs [
          "x86_64-linux"
          "aarch64-linux"
          "x86_64-darwin"
          "aarch64-darwin"
        ] (system: function (import nixpkgs { inherit system; }));
    in
    {
      packages = forAllSystems (pkgs: rec {
        ist-discord-bot = pkgs.callPackage ./nix/package.nix { };
        default = ist-discord-bot;
      });

      nixosModules = rec {
        ist-discord-bot = import ./nix/module.nix;
        default = ist-discord-bot;
      };

      devShell = forAllSystems (
        pkgs:
        pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            pnpm
          ];
          shellHook = with pkgs; ''
            export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
            export PRISMA_INTROSPECTION_ENGINE_BINARY="${prisma-engines}/bin/introspection-engine"
            export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"
          '';
        }
      );
    };
}
