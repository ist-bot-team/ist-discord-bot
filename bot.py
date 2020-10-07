from discord import Embed, PermissionOverwrite
from discord.ext import commands
from discord.utils import get
from asyncio import Lock
import os
import json

# Funcionalidades:
# - comando para dar administrador temporariamente aos mods
# - receber novos membros
# - permitir a escolha de curso

# Carregar versão do bot
with open('version', 'r') as file:
    version_number = file.read().replace('\n', '')
    print("Version {}".format(version_number))

# Informação dos cursos
# "display": conteúdo da mensagem utilizada no curso
# "name": nome da role do curso (tem de estar presente no "display")
# "tagus": é um curso do Tagus Park?
# "msg_id": indice da mensagem que foi enviada
with open('courses.json', 'r', encoding='utf-8') as file:
    courses = json.load(file)

# O formato de embed pode ser gerado com ferramentas online e umas pequenas alterações.
# De momento o parsing deste json apenas suporta:
#   - title
#   - description
#   - color
#   - fields com name e value (a propriedade inline é ignorada)
# Caso se adicionem embeds mais complexos no json será necessário alterar parse_embed
with open('embeds.json', 'r', encoding='utf-8') as file:
    embeds = json.load(file)

with open('courses_by_degree.json', 'r', encoding='utf-8') as file:
    courses_by_degree = json.load(file)

bot = commands.Bot(command_prefix='$')
state = {}

# embed: key do embed no embed.json a que se pretende aceder


def parse_embed(embed):
    if embed not in embeds:
        print('Warning: the key {} isn\'t in embed.json'.format(embed))
        return parse_embed('error')

    ret = Embed(
        title=embeds[embed]['title'],
        description=embeds[embed]['description'],
        color=embeds[embed]['color']
    )

    for field in embeds[embed]['fields']:
        ret.add_field(
            value=field['value'].replace('$veterano', role_veterano.mention).replace(
                '$turista', role_turista.mention),
            name=field['name'],
            inline=False
        )

    ret.set_thumbnail(
        url='https://upload.wikimedia.org/wikipedia/pt/e/ed/IST_Logo.png')

    return ret


async def rebuild_course_channels():
    channels = courses_category.text_channels

    for course in courses_by_degree:
        permissions = {
            guild.default_role: PermissionOverwrite(read_messages=False)
        }
        for degree in courses_by_degree[course]:
            degree_obj = next(
                (item for item in courses if item["name"] == degree), None)
            if degree_obj is not None:
                permissions[degree_obj["role"]] = PermissionOverwrite(
                    read_messages=True)

        course_channel = get(courses_category.text_channels,
                             name=course.lower())
        if course_channel is None:
            await courses_category.create_text_channel(course.lower(), overwrites=permissions)
        else:
            await course_channel.edit(overwrites=permissions)


async def rebuild():
    await roles_channel.purge()

    await roles_channel.send(embed=parse_embed('welcome-pt'))
    await roles_channel.send(embed=parse_embed('welcome-en'))

    for i in range(0, len(courses)):
        msg = await roles_channel.send("`{}`".format(courses[i]["display"]))
        await msg.add_reaction('1️⃣')
        await msg.add_reaction('2️⃣')
        await msg.add_reaction('3️⃣')
        await msg.add_reaction('4️⃣')
        await msg.add_reaction('5️⃣')
        courses[i]["msg_id"] = msg.id

# Events


@bot.event
async def on_ready():
    print('Bot iniciado com o utilizador {0.user}'.format(bot))

    if len(bot.guilds) != 1:
        print('O bot tem de estar em exatamente um guild, no entanto está em {} guilds'.format(
            len(bot.guilds)))
        exit(-1)

    global guild
    guild = bot.guilds[0]

    if len(guild.text_channels) < 2:
        print('O guild tem de ter pelo menos dois canais de texto')
        exit(-1)

    global roles_channel
    global welcome_channel
    roles_channel = guild.text_channels[0]
    welcome_channel = guild.text_channels[1]

    global courses_category
    courses_category = get(guild.categories, name="Cadeiras")

    global role_turista
    global role_aluno
    global role_veterano
    global role_tagus
    global role_alameda
    global role_mod
    global role_admin
    global role_anos
    role_turista = get(guild.roles, name="TurISTa")
    role_aluno = get(guild.roles, name="Aluno")
    role_veterano = get(guild.roles, name="Veterano/a")
    role_tagus = get(guild.roles, name="Tagus Park")
    role_alameda = get(guild.roles, name="Alameda")
    role_mod = get(guild.roles, name="Mod")
    role_admin = get(guild.roles, name="Admin")
    role_anos = list()

    for i in range(1, 6):
        role_anos.append(get(guild.roles, name=(str(i) + "º ano")))
        if role_anos[i - 1] is None:
            print('O guild tem de ter uma role para cada ano, 1, 2, 3, 4 e 5 (xº ano)')
            exit(-1)

    if role_turista is None or role_aluno is None or role_veterano is None or role_tagus is None or role_alameda is None or role_mod is None or role_admin is None:
        print('O guild tem de ter uma role "Turista", uma role "Aluno", uma role "Veterano", uma role "Tagus Park", uma role "Alameda", uma role "Mod" e uma role "Admin".')
        exit(-1)

    # Associar cada curso a uma role
    for i in range(0, len(courses)):
        courses[i]["role"] = None
        for role in guild.roles:
            if role.name == courses[i]["name"]:
                courses[i]["role"] = role
                break
        if courses[i]["role"] is None:
            print("A role com o nome {} nao existe".format(courses[i]["name"]))
            exit(-1)

    if courses_category is None:
        print('O guild tem de ter uma categoria "Cadeiras".')
        exit(-1)


@bot.event
async def on_member_join(member):
    await welcome_channel.send('Bem vind@ {}! Verifica as tuas DMs, vais receber uma mensagem com as instruções a seguir.'.format(member.mention))
    await member.add_roles(role_turista)

    # Enviar DM
    channel = await member.create_dm()
    await channel.send("Hey Hey")


@bot.event
async def on_message(msg):
    global state

    await bot.process_commands(msg)
    if not msg.guild:
        print('Received a DM from {}'.format(msg.author))
        stage = 1
        if msg.author.id in state:
            stage = state[msg.author.id]["stage"] + 1

        state[msg.author.id]["stage"] = stage

# Commands


@bot.command(pass_context=True)
async def version(ctx):
    await ctx.message.channel.send("{}".format(version_number))


@bot.command(pass_context=True)
async def admin(ctx):
    if not role_mod in ctx.author.roles:
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return

    if role_admin not in ctx.author.roles:
        await ctx.author.add_roles(role_admin)
    else:
        await ctx.author.remove_roles(role_admin)


@bot.command(pass_context=True)
async def refresh(ctx):
    if not role_mod in ctx.author.roles:
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return
    await ctx.message.channel.send('A atualizar o bot...')
    await rebuild()
    await rebuild_course_channels()
    await ctx.message.channel.send('Feito')

bot.run(os.environ['DISCORD_TOKEN'])
