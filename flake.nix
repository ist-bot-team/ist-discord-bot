{
  inputs = {
    nixpkgs.url = "flake:nixpkgs";
    flake-parts.url = "github:hercules-ci/flake-parts";
    pre-commit-hooks-nix = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.nixpkgs-stable.follows = "nixpkgs";

    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  outputs = inputs@{ flake-parts, self, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        # To import a flake module
        # 1. Add foo to inputs
        # 2. Add foo as a parameter to the outputs function
        # 3. Add here: foo.flakeModule
        inputs.pre-commit-hooks-nix.flakeModule
        # inputs.devenv.flakeModule
        inputs.treefmt-nix.flakeModule

      ];
      flake = {
        # Put your original flake attributes here.
      };
      #systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      systems = [
        # systems for which you want to build the `perSystem` attributes
        "x86_64-linux"
        # ...
      ];
      # perSystem = { config, self', inputs', pkgs, system, ... }: {
      perSystem = { pkgs, ... }: {
        # Per-system attributes can be defined here. The self' and inputs'
        # module parameters provide easy access to attributes of the same
        # system.
    
        packages.default = pkgs.callPackage ./package.nix { inherit self; };

        # packages.default = pkgs.mkYarnPackage {
        #   src = ./.;
        #   preBuild = ''
        #     # somehow for linux, npm is not finding the prisma package with the
        #     # packages installed with the lockfile.
        #     # This generates a prisma version incompatibility warning and is a kludge
        #     # until the upstream package-lock is modified.
        #     # ${pkgs.nodePackages.prisma}/bin/prisma generate
        #   '';

        #     installPhase = ''
        #         runHook preInstall
            
        #         mkdir $out
        #         cp -r $src/* $out/
        #         ${pkgs.nodePackages.prisma}/bin/prisma generate --schema=$out/src/prisma/schema.prisma
            
        #         runHook postInstall
        #       '';
        # };

        # Equivalent to  inputs'.nixpkgs.legacyPackages.hello;
        # packages.default = pkgs.hello;
        devShells.default = pkgs.mkShell {
          #Add executable packages to the nix-shell environment.
          packages = with pkgs.nodePackages; [
            pkgs.nodejs_18
            prettier
            prisma
            typescript
          ];
            PRISMA_MIGRATION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/migration-engine";
            PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
            PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
            PRISMA_INTROSPECTION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/introspection-engine";
            PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";

          # Add build dependencies of the listed derivations to the nix-shell environment.
          # inputsFrom = [ pkgs.hello pkgs.gnutar ];

          #  shellHook (default: ""). Bash statements that are executed by nix-shell.
          shellHook = ''
            export DEBUG=1
          '';

        };
        pre-commit = {
          check.enable = true;
          settings.hooks = {
            # shellcheck.enable = true;
            deadnix.enable = true;
            statix.enable = true;
            markdownlint.enable = false;
          };
        };
        treefmt.projectRootFile = ./flake.nix;
        treefmt.programs = {
          nixpkgs-fmt.enable = true;
          yamlfmt.enable = true;
          # shellcheck.enable = true;
          shfmt.enable = true;
          mdformat.enable = true;

        };
      };
    };

}
