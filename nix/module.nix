{
  config,
  lib,
  pkgs,
  ...
}:
let
  inherit (lib)
    concatStringsSep
    filterAttrs
    getExe
    hasPrefix
    hasSuffix
    isString
    literalExpression
    maintainers
    mapAttrs
    mkEnableOption
    mkIf
    mkOption
    mkPackageOption
    optional
    types
    ;

  cfg = config.services.ist-discord-bot;

  nonFileSettings = filterAttrs (k: _: !hasSuffix "_FILE" k) cfg.settings;
in
{
  options.services.ist-discord-bot = {
    enable = mkEnableOption "ist-discord-bot";

    package = mkPackageOption pkgs "ist-discord-bot" { };

    createPostgresqlDatabase = mkOption {
      type = types.bool;
      default = true;
      example = false;
      description = ''
        Whether to automatically create the database for IST Discord Bot using PostgreSQL.
        Both the database name and username will be `ist-discord-bot`, and the connection is
        made through unix sockets using peer authentication.
      '';
    };

    settings = mkOption {
      description = ''
        Additional configuration (environment variables) for IST Discord Bot.
      '';

      type = types.submodule {
        freeformType =
          with types;
          attrsOf (oneOf [
            bool
            int
            str
          ]);

        options = {
          DATABASE_URL = mkOption {
            type = types.nullOr (
              types.str
              // {
                check = it: isString it && ((hasPrefix "postgresql://" it) || (hasPrefix "postgres://" it));
              }
            );
            # For some reason, Prisma requires the username in the connection string
            # and can't derive it from the current user.
            default =
              if cfg.createPostgresqlDatabase then
                "postgresql://ist-discord-bot@localhost/ist-discord-bot?host=/run/postgresql"
              else
                null;
            defaultText = literalExpression ''if config.services.ist-discord-bot.createPostgresqlDatabase then "postgresql://ist-discord-bot@localhost/ist-discord-bot?host=/run/postgresql" else null'';
            example = "postgresql://root:root@localhost/ist-discord-bot";
            description = ''
              Connection string for the database. Must start with `postgresql://` or `postgres://`.
            '';
          };
          DISCORD_TOKEN_FILE = mkOption {
            type = types.nullOr (
              types.str
              // {
                # We don't want users to be able to pass a path literal here but
                # it should look like a path.
                check = it: isString it && types.path.check it;
              }
            );
            default = null;
            example = "/run/secrets/istDiscordBotDiscordToken";
            description = ''
              A file containing the token for the Discord bot.
              The contents of the file are read through systemd credentials, therefore the
              user running ist-discord-bot does not need permissions to read the file.
            '';
          };
          GUILD_ID = mkOption {
            type = types.str;
            example = "123456789";
            description = ''
              The ID of the Discord guild (server) where this bot is supposed to run.
            '';
          };
          ADMIN_ID = mkOption {
            type = types.str;
            example = "123456789";
            description = ''
              The ID of the Discord role "Admin" in the guild.
            '';
          };
          ADMIN_PLUS_ID = mkOption {
            type = types.str;
            example = "123456789";
            description = ''
              The ID of the Discord role "Admin+" (super user) in the guild.
            '';
          };
          COMMAND_LOGS_CHANNEL_ID = mkOption {
            type = types.str;
            example = "123456789";
            description = ''
              The ID of the Discord channel in the guild where all bot commands will be logged to.
            '';
          };
        };
      };

      default = { };
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = (cfg.settings.DISCORD_TOKEN_FILE != null) != (cfg.settings ? DISCORD_TOKEN);
        message = "One (and only one) of services.ist-discord-bot.settings.DISCORD_TOKEN_FILE and services.ist-discord-bot.settings.DISCORD_TOKEN must be set.";
      }
      {
        assertion = cfg.settings.DATABASE_URL != null;
        message = "services.ist-discord-bot.settings.DATABASE_URL must be set.";
      }
      {
        assertion =
          cfg.createPostgresqlDatabase
          ->
            cfg.settings.DATABASE_URL
            == "postgresql://ist-discord-bot@localhost/ist-discord-bot?host=/run/postgresql";
        message = "The option config.services.ist-discord-bot.createPostgresqlDatabase is enabled, but config.services.ist-discord-bot.settings.DATABASE_URL has been modified.";
      }
    ];

    services.postgresql = mkIf cfg.createPostgresqlDatabase {
      enable = true;
      ensureDatabases = [ "ist-discord-bot" ];
      ensureUsers = [
        {
          name = "ist-discord-bot";
          ensureDBOwnership = true;
          ensureClauses.login = true;
        }
      ];
    };

    systemd.services.ist-discord-bot = {
      environment = mapAttrs (_: toString) nonFileSettings;

      description = "IST Discord Bot: Discord Bot for the IST Hub Discord server";
      after = [ "network.target" ] ++ (optional (cfg.createPostgresqlDatabase) "postgresql.service");
      wantedBy = [ "multi-user.target" ];

      script =
        let
          loadCredentials = optional (
            cfg.settings.DISCORD_TOKEN_FILE != null
          ) ''export DISCORD_TOKEN="$(systemd-creds cat discordToken)"'';
        in
        ''
          ${concatStringsSep "\n" loadCredentials}
          ${getExe cfg.package}
        '';

      serviceConfig = {
        Type = "simple";
        Restart = "on-failure";
        RestartSec = 3;
        DynamicUser = true;

        LoadCredential = optional (
          cfg.settings.DISCORD_TOKEN_FILE != null
        ) "discordToken:${cfg.settings.DISCORD_TOKEN_FILE}";

        # Hardening
        CapabilityBoundingSet = "";
        NoNewPrivileges = true;
        PrivateUsers = true;
        PrivateTmp = true;
        PrivateDevices = true;
        PrivateMounts = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        RestrictAddressFamilies = (optional cfg.createPostgresqlDatabase "AF_UNIX") ++ [
          "AF_INET"
          "AF_INET6"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
      };
    };
  };

  meta.maintainers = with maintainers; [ diogotcorreia ];
}
