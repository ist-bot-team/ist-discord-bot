{
  description = "Description for the project";

  inputs = {
    nixpkgs.url = "flake:nixpkgs";
      devenv.url = "github:cachix/devenv";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        # To import a flake module
        # 1. Add foo to inputs
        # 2. Add foo as a parameter to the outputs function
        # 3. Add here: foo.flakeModule
          inputs.devenv.flakeModule

      ];
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      perSystem = { config, self', inputs', pkgs, system, ... }: {
        # Per-system attributes can be defined here. The self' and inputs'
        # module parameters provide easy access to attributes of the same
        # system.

        # Equivalent to  inputs'.nixpkgs.legacyPackages.hello;
        # packages.default = pkgs.hello;
        # packages.default = pkgs.callPackage ./default.nix;
        packages.default = pkgs.buildNpmPackage rec {
            pname = "ist-discord-bot";
            version = "1.0.0";
            src = ./.;
            npmDepsHash = "sha256-tuEfyePwlOy2/mOPdXbqJskO6IowvAP4DWg8xSZwbJw=";

        };

        devenv.shells.default = {
            packages = with pkgs.nodePackages; [
                pkgs.nodejs_18
                pkgs.yarn
                prettier
                prisma
            ];
            env = {
              PRISMA_MIGRATION_ENGINE_BINARY="${prisma-engines}/bin/migration-engine";
              PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine";
              PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node";
              PRISMA_INTROSPECTION_ENGINE_BINARY="${prisma-engines}/bin/introspection-engine";
              PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt";
            };
        };
      };
      flake = {
        # The usual flake attributes can be defined here, including system-
        # agnostic ones like nixosModule and system-enumerating ones, although
        # those are more easily expressed in perSystem.

      };
    };
}
