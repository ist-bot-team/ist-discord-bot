{
  fetchFromGitHub,
  fetchPnpmDeps,
  lib,
  makeWrapper,
  nodejs,
  openssl,
  pnpmConfigHook,
  pnpm_10,
  prisma-engines_7,
  rustPlatform,
  stdenvNoCC,
  ...
}:
let
  pnpm = pnpm_10;
  prisma-engines' = prisma-engines_7.overrideAttrs (old: rec {
    version = "7.2.0";
    src = fetchFromGitHub {
      owner = "prisma";
      repo = "prisma-engines";
      tag = version;
      hash = "sha256-1CwpUtNuqxGNjBmmmo/Aet8XrmnCQfDToI7vZaNupDI=";
    };
    cargoHash = "sha256-U5d/HkuWnD/XSrAJr5AYh+WPVGDOcK/e4sC0udPZoyU=";

    cargoDeps = rustPlatform.fetchCargoVendor {
      inherit (old) pname;
      inherit src version;
      hash = cargoHash;
    };
  });
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "ist-discord-bot";
  version = (lib.importJSON ../package.json).version;
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../src
      ../package.json
      ../pnpm-lock.yaml
      ../tsconfig.json
      ../prisma.config.ts
    ];
  };

  nativeBuildInputs = [
    makeWrapper
    nodejs
    pnpm
    pnpmConfigHook
  ];

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs)
      pname
      version
      src
      ;
    fetcherVersion = 3;
    hash = "sha256-M3x+qncWk/pdvrvB1AkwByhK9L5XTZZtbtvwPfchwyY=";
  };

  # Allow prisma-cli to find prisma-engines without having to download them
  env.PRISMA_QUERY_ENGINE_LIBRARY = "${prisma-engines'}/lib/libquery_engine.node";
  env.PRISMA_SCHEMA_ENGINE_BINARY = "${prisma-engines'}/bin/schema-engine";
  env.DATABASE_URL = "postgresql://";

  buildPhase = ''
    runHook preBuild

    pnpm prisma:generate
    pnpm build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    local -r packageOut="$out/lib/node_modules/ist-discord-bot"

    # delete dev dependencies
    rm -rf node_modules
    pnpm install --prod --no-optional --ignore-scripts

    mkdir -p "$packageOut"
    cp -r dist "$packageOut"
    cp -r node_modules "$packageOut"
    mkdir -p "$packageOut/prisma"
    cp src/prisma/schema.prisma "$packageOut/prisma"
    cp -r src/prisma/migrations "$packageOut/prisma"

    # Run database migrations before starting ist-discord-bot.
    # Add openssl to PATH since it is required for prisma to make SSL connections.
    # Force working directory to $packageOut because ist-discord-bot may assume paths are relative to it.
    makeWrapper "${lib.getExe nodejs}" "$out"/bin/ist-discord-bot \
      --set NODE_ENV production \
      --set PRISMA_QUERY_ENGINE_LIBRARY "${prisma-engines'}/lib/libquery_engine.node" \
      --set PRISMA_SCHEMA_ENGINE_BINARY "${prisma-engines'}/bin/schema-engine" \
      --prefix PATH : ${
        lib.makeBinPath [
          openssl
          nodejs
        ]
      } \
      --chdir "$packageOut" \
      --run "$packageOut/node_modules/.bin/prisma migrate deploy --schema $packageOut/prisma/schema.prisma" \
      --add-flags "--enable-source-maps" \
      --add-flags "$packageOut"/dist/bot.js

    runHook postInstall
  '';

  passthru = {
    prisma-engines = prisma-engines';
  };

  meta = {
    changelog = "https://github.com/ist-bot-team/ist-discord-bot/releases/tag/v${finalAttrs.version}";
    description = "Discord Bot for the IST Hub Discord server ";
    homepage = "https://github.com/ist-bot-team/ist-discord-bot";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
    mainProgram = "ist-discord-bot";
    maintainers = with lib.maintainers; [ diogotcorreia ];
  };
})
