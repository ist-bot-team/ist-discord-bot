{
  inputs = {
    nixpkgs.url = "flake:nixpkgs";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
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
  outputs = inputs@{ flake-parts, ... }:
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
        "aarch64-linux"
      ];
      # perSystem = { config, self', inputs', pkgs, system, ... }: {
      perSystem = { config, pkgs, ... }:
        let
          node = pkgs.nodejs_18;
        in
        {
          # Per-system attributes can be defined here. The self' and inputs'
          # module parameters provide easy access to attributes of the same
          # system.

          packages =
            let
              ist-discord-bot-env = pkgs.callPackage ./package.nix { };
              binStub = pkgs.writeShellScriptBin "ist-discord-bot"
                ''
                  exec ${node}/bin/node ${ist-discord-bot-env}/lib/node_modules/ist-discord-bot
                '';

            in
            rec {
              default = ist-discord-bot;
              # adds symlinks of hello and stack to current build and prints "links added"
              ist-discord-bot =
                pkgs.symlinkJoin { name = "ist-discord-bot"; paths = [ ist-discord-bot-env binStub ]; };

              inherit ist-discord-bot-env;
              # docker-img = pkgs.callPackage ./dockerImage.nix { };
            };

          devShells.default = pkgs.mkShell {
            #Add executable packages to the nix-shell environment.
            packages = with pkgs; [
              openssl
              node
              nodePackages.npm
              nodePackages.prettier
              nodePackages.prisma
              typescript
            ];
            nativeBuildInputs = with pkgs; [
              openssl
            ];
            buildInputs = with pkgs; [
              openssl
            ];


            # PRISMA_MIGRATION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/migration-engine";


            PRISMA_SKIP_POSTINSTALL_GENERATE = 1;
            PRISMA_GENERATE_SKIP_AUTOINSTALL = 1;
            PRISMA_CLI_QUERY_ENGINE_TYPE = "binary";
            PRISMA_CLIENT_ENGINE_TYPE = "binary";


            PRISMA_MIGRATION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/migration-engine";
            PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
            PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
            PRISMA_INTROSPECTION_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/introspection-engine";
            PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";

            shellHook = ''
              export DEBUG=1
              ${config.pre-commit.installationScript}
            '';
          };

          pre-commit.settings.hooks = {
            treefmt.enable = true;
            gitleaks = {
              enable = true;
              name = "gitleaks";
              description = "Prevents commiting secrets";
              entry = "${pkgs.gitleaks}/bin/gitleaks protect --verbose --redact --staged";
              pass_filenames = false;
            };
            actionlint.enable = true;
          };

          treefmt.projectRootFile = ./flake.nix;
          treefmt.programs = {
            yamlfmt.enable = true;
            nixpkgs-fmt.enable = true;
            shellcheck.enable = true;
            shfmt.enable = true;
            mdformat.enable = true;
            deadnix.enable = true;
            statix.enable = true;
            prettier.enable = true;
            statix.disabled-lints = [
              "repeated_keys"
            ];

          };
        };
    };
}
