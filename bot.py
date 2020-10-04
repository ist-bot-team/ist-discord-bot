from discord import Embed
from discord.ext import commands
from discord.utils import get
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

bot = commands.Bot(command_prefix='$')

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
            value=field['value'].replace('$veterano', role_veterano.mention).replace('$turista', role_turista.mention),
            name=field['name'],
            inline=False
        )

    ret.set_thumbnail(url='https://upload.wikimedia.org/wikipedia/pt/e/ed/IST_Logo.png')

    return ret

def has_perms(member):
    return role_mod in member.roles

async def rebuild():
    await roles_channel.purge()

    await roles_channel.send(embed=parse_embed('welcome-pt'))
    await roles_channel.send(embed=parse_embed('welcome-en'))

    for i in range(0, len(courses)):
        msg = await roles_channel.send("`{}`".format(courses[i]["display"]))
        await msg.add_reaction('☑️')
        courses[i]["msg_id"] = msg.id

@bot.command(pass_context=True)
async def refresh(ctx):
    if not has_perms(ctx.author):
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return
    await ctx.message.channel.send('A atualizar o bot...')
    await rebuild()
    await ctx.message.channel.send('Feito')

@bot.command(pass_context=True)
async def refresh_roles(ctx):
    if not has_perms(ctx.author):
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return

    # Verificar se há membros que não são alunos que não tem role de turista
    for member in guild.members:
        if member.bot:
            continue

        is_aluno = False
        for course in courses:
            if course["role"] in member.roles:
                if course["tagus"]:
                    await member.remove_roles(role_alameda)
                    await member.add_roles(role_tagus)
                else:
                    await member.remove_roles(role_tagus)
                    await member.add_roles(role_alameda)
                is_aluno = True
                await member.add_roles(role_aluno)
                continue
        if not is_aluno:
            await member.remove_roles(role_tagus, role_alameda, role_aluno)
            await member.add_roles(role_turista)

@bot.command(pass_context=True)
async def admin(ctx):
    if not has_perms(ctx.author):
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return

    if role_admin not in ctx.author.roles:
        await ctx.author.add_roles(role_admin)
    else:
        await ctx.author.remove_roles(role_admin)

@bot.event
async def on_ready():
    print('Bot iniciado com o utilizador {0.user}'.format(bot))

    if len(bot.guilds) != 1:
        print('O bot tem de estar em exatamente um guild, no entanto está em {} guilds'.format(len(bot.guilds)))
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

    global role_turista
    global role_aluno
    global role_veterano
    global role_tagus
    global role_alameda
    global role_mod
    global role_admin
    global role_anos
    role_turista = get(guild.roles, name="Turista")
    role_aluno = get(guild.roles, name="Aluno")
    role_veterano = get(guild.roles, name="Veterano/a")
    role_tagus = get(guild.roles, name="Tagus Park")
    role_alameda = get(guild.roles, name="Alameda")
    role_mod = get(guild.roles, name="Mod")
    role_admin = get(guild.roles, name="Admin")
    role_anos = list()
    for i in range(1, 6):
        role_anos.append(get(guild.roles, name=(str(i) + "º ano")))
        if role_anos[i] is None:
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

    # Verificar se as mensagens de entrada já estão no canal certo
    found_count = 0
    roles_messages = await roles_channel.history().flatten()
    for msg in roles_messages:
        for course in courses:
            if course["display"] in msg.content and msg.author.bot:
                course["msg_id"] = msg.id
                found_count += 1
                break

    # Senão estiverem todas, apaga todas as mensagens do canal e escreve de novo
    if found_count != len(courses):
        await rebuild()

@bot.event
async def on_member_join(member):
    await welcome_channel.send('Bem vind@ {}! Escolhe o teu curso em {}.'.format(member.mention, roles_channel.mention))
    await member.add_roles(role_turista)

@bot.command(pass_context=True)
async def version(ctx):
    await ctx.message.channel.send("{}".format(version_number))

@bot.event
async def on_raw_reaction_add(payload):
    if payload.channel_id != roles_channel.id:
        return

    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return
    
    if payload.emoji.name == '1️⃣':
        year = 0
    elif payload.emoji.name == '2️⃣':
        year = 1
    elif payload.emoji.name == '3️⃣':
        year = 2
    elif payload.emoji.name == '4️⃣':
        year = 3
    elif payload.emoji.name == '5️⃣':
        year = 4
    else:
        return

    # Encontrar a mensagem correta
    for course in courses:
        if course["msg_id"] == payload.message_id:
            # Verificar se o membro já tem qualquer outra role de curso
            for course_2 in courses:
                if course == course_2:
                    continue
                if course_2["role"] in member.roles:
                    msg = await roles_channel.fetch_message(payload.message_id)
                    await msg.remove_reaction(payload.emoji.name, member)
                    return
            print("Role do curso {} adicionada ao membro {}".format(course["name"], member))
            await member.remove_roles(role_turista)
            await member.add_roles(course["role"], role_aluno, role_anos[year])
            if course["tagus"]:
                await member.add_roles(role_tagus)
            else:
                await member.add_roles(role_alameda)
            return

@bot.event
async def on_raw_reaction_remove(payload):
    if payload.channel_id != roles_channel.id:
        return

    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return

    if payload.emoji.name == '1️⃣':
        year = 0
    elif payload.emoji.name == '2️⃣':
        year = 1
    elif payload.emoji.name == '3️⃣':
        year = 2
    elif payload.emoji.name == '4️⃣':
        year = 3
    elif payload.emoji.name == '5️⃣':
        year = 4
    else:
        return

    # Encontrar a mensagem correta
    for course in courses:
        if course["msg_id"] == payload.message_id:
            if course["role"] in member.roles:
                if course["tagus"]:
                    await member.remove_roles(role_tagus)
                else:
                    await member.remove_roles(role_alameda)
                await member.remove_roles(course["role"], role_aluno, role_anos[year])
                await member.add_roles(role_turista)
            print("Role do curso {} removida do membro {}".format(course["name"], member))
            return

bot.run(os.environ['DISCORD_TOKEN'])
