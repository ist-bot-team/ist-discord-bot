{
  fetchFromGitHub,
  lib,
  makeWrapper,
  nodejs,
  openssl,
  pnpm_10,
  prisma-engines,
  rustPlatform,
  stdenvNoCC,
  ...
}:
let
  pnpm = pnpm_10;
  prisma-engines' = prisma-engines.overrideAttrs (old: rec {
    version = "6.16.3";
    src = fetchFromGitHub {
      owner = "prisma";
      repo = "prisma-engines";
      tag = version;
      hash = "sha256-vAOidJspGEbk9jzw38ax/fAm9OnQobnmXg8i4kPR0lg=";
    };
    cargoHash = "sha256-tNsc6z0CC5Cvj6tJBSXxV4D3ql7Ji3NCOn8NCVE3Ymg=";

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
  src = ../.;

  nativeBuildInputs = [
    makeWrapper
    nodejs
    pnpm.configHook
  ];

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs)
      pname
      version
      src
      ;
    fetcherVersion = 2;
    hash = "sha256-vheH2gpdHBnfP161Bs/wNi21vY3RPBZhOqtoDRGtyHA=";
  };

  # Allow prisma-cli to find prisma-engines without having to download them
  env.PRISMA_QUERY_ENGINE_LIBRARY = "${prisma-engines'}/lib/libquery_engine.node";
  env.PRISMA_SCHEMA_ENGINE_BINARY = "${prisma-engines'}/bin/schema-engine";

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
