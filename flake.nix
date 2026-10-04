{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, self, ... }:
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

      checks = forAllSystems (
        pkgs:
        let
          inherit (pkgs.stdenv.hostPlatform) system;
          inherit (self.packages.${system}) ist-discord-bot;
        in
        {
          pnpm-deps = ist-discord-bot.pnpmDeps;
          prisma-engines-correct-version =
            let
              currentVersion = ist-discord-bot.passthru.prisma-engines.version;
              expectedVersion = (pkgs.lib.importJSON ./package.json).dependencies.prisma;
            in
            assert currentVersion == expectedVersion;
            pkgs.runCommand "prisma-engines-correct-version-check" {} ''
              touch $out
            '';
        }
      );

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            pnpm_11
          ];
          shellHook = with pkgs; ''
            export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node"
            export PRISMA_INTROSPECTION_ENGINE_BINARY="${prisma-engines}/bin/introspection-engine"
            export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt"
          '';
        };
      });
    };
}
