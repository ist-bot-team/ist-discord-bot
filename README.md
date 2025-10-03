# IST Discord Bot

![GitHub tag (latest by date)](https://img.shields.io/github/v/tag/ist-bot-team/ist-discord-bot?label=version)
[![Discord](https://img.shields.io/discord/759576132227694642?label=discord&logo=discord)](https://discord.leic.pt)
![GitHub](https://img.shields.io/github/license/ist-bot-team/ist-discord-bot)

Discord bot to manage the IST Hub server -- join [here](https://discord.leic.pt).

### Running

#### Production

1. Create a `docker-compose.yml` file as below:

```yaml
services:
    ist-discord-bot:
        ## EITHER:
        image: ghcr.io/ist-bot-team/ist-discord-bot:3
        ## OR:
        build:
            context: .
        ## END;
        environment:
            DATABASE_URL: postgresql://istbot:istbot@postgres/istbot
            DISCORD_TOKEN: PLACE_BOT_TOKEN_HERE
            GUILD_ID: PLACE_MAIN_GUILD_ID_HERE # or "GLOBAL" to use in multiple guilds (1hr roll-out time)
            ADMIN_ID: PLACE_ADMIN_ROLE_ID_HERE
            ADMIN_PLUS_ID: PLACE_ADMIN_PLUS_ROLE_ID_HERE
            COMMAND_LOGS_CHANNEL_ID: PLACE_LOGGING_CHANNEL_ID_HERE
            TZ: Europe/Lisbon # default timezone for crontab and other date related stuff
        restart: unless-stopped

    postgres:
        image: postgres:18
        ports:
            - 127.0.0.1:5432:5432
        environment:
            POSTGRES_USER: istbot
            POSTGRES_PASSWORD: istbot
            POSTGRES_DB: istbot
        volumes:
            - pgdata:/var/lib/postgresql

volumes:
    pgdata:
```

2. Create a folder named `data` for Docker to store things in
3. Run `docker-compose up -d --build`
4. That's it!

_You can also use `docker-compose down`, `docker-compose up`, `docker-compose restart` and `docker-compose logs [-f]`._

### Adding to a Server

Replacing `CLIENT_ID` with the application's public ID, access the following link:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=8
```

The bot needs the **Server Members Intent** and the **Message Content Intent** enabled
on [Discord's Application](https://discord.com/developers/applications) -> Bot page.
If this is not enabled, an error will be thrown on startup.

### Development

If you're looking at the source code, you should probably run

```sh
pnpm prisma:generate
```

first so you can have typings.
