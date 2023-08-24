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
        packages.default = pkgs.mkYarnPackage {
          src = ./.;
          preBuild = ''
            # somehow for linux, npm is not finding the prisma package with the
            # packages installed with the lockfile.
            # This generates a prisma version incompatibility warning and is a kludge
            # until the upstream package-lock is modified.
            ${pkgs.nodePackages.prisma}/bin/prisma generate
          '';
            installPhase = ''
                runHook preInstall
            
                mkdir $out
                cp -r $src/* $out/
            
                runHook postInstall
              '';
        };


        devenv.shells.default = {
          packages = with pkgs.nodePackages; [
            pkgs.nodejs_18
            pkgs.yarn
            pkgs.yarn2nix
            prettier
            prisma
            typescript
          ];

          env = with pkgs; {
            PRISMA_MIGRATION_ENGINE_BINARY = "${prisma-engines}/bin/migration-engine";
            PRISMA_QUERY_ENGINE_BINARY = "${prisma-engines}/bin/query-engine";
            PRISMA_QUERY_ENGINE_LIBRARY = "${prisma-engines}/lib/libquery_engine.node";
            PRISMA_INTROSPECTION_ENGINE_BINARY = "${prisma-engines}/bin/introspection-engine";
            PRISMA_FMT_BINARY = "${prisma-engines}/bin/prisma-fmt";
          };
          dotenv.enable = true;
        };
      };
      flake = {
        # The usual flake attributes can be defined here, including system-
        # agnostic ones like nixosModule and system-enumerating ones, although
        # those are more easily expressed in perSystem.

      };
    };
}
