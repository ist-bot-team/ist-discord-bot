from discord import Embed
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
            value=field['value'].replace('$veterano', role_veterano.mention).replace('$turista', role_turista.mention),
            name=field['name'],
            inline=False
        )

    ret.set_thumbnail(url='https://upload.wikimedia.org/wikipedia/pt/e/ed/IST_Logo.png')

    return ret

# Events

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
    role_turista = get(guild.roles, name="TurISTa")
    role_aluno = get(guild.roles, name="Aluno")
    role_veterano = get(guild.roles, name="Veterano/a")
    role_tagus = get(guild.roles, name="Tagus Park")
    role_alameda = get(guild.roles, name="Alameda")
    role_mod = get(guild.roles, name="Mod")
    role_admin = get(guild.roles, name="Admin")

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

    global courses_info_msg
    courses_info_msg = ""
    for course in courses:
        courses_info_msg += course["display"] + '\n'

@bot.event
async def on_member_join(member):
    global state

    await welcome_channel.send('Bem vind@ {}! Verifica as tuas DMs, vais receber uma mensagem com as instruções a seguir.'.format(member.mention))
    await member.add_roles(role_turista)

    # Enviar DM
    channel = await member.create_dm()
    await channel.send(embed=parse_embed('welcome-pt'))
    await channel.send(embed=parse_embed('welcome-en'))
    state[member.id] = { "stage": 1 }
    print("{} entrou".format(member.id))

@bot.event
async def on_message(msg):
    if msg.author.bot:
        return

    global state

    await bot.process_commands(msg)
    if not msg.guild:
        print('Mensagem recebida de {}'.format(msg.author.id))

        if msg.author.id not in state:
            return
        
        if state[msg.author.id]["stage"] == 1:
            # Verificar se o curso existe e adicioná-lo ao utilizador
            print("Curso {}".format(msg.content))
            found = False
            for course in courses:
                if course["name"].lower() in msg.content.lower():
                    # Adiciona role ao utilizador
                    member = guild.get_member(msg.author.id)
                    if course["tagus"]:
                        await member.add_roles(course["role"], role_aluno, role_tagus)
                        await member.remove_roles(role_turista)
                    else:
                        await member.add_roles(course["role"], role_aluno, role_alameda)
                        await member.remove_roles(role_turista)
                    await msg.channel.send("Curso {} escolhido. Este é o teu primeiro ano no técnico? Responde com [yes] ou [no].".format(course["name"]))
                    await msg.channel.send("Degree {} chosen. Is this your first year on IST? Answer with [yes] or [no].".format(course["name"]))
                    state[msg.author.id]["stage"] = 2
                    found = True
                    print("Adicionada role do curso {} ao user {}".format(course["name"], msg.author))
                    break

            if msg.content.lower() == "turista":
                state[msg.author.id]["stage"] = 3
                await msg.channel.send(embed=parse_embed('finish-pt'))
                await msg.channel.send(embed=parse_embed('finish-en'))
            elif not found:
                await msg.channel.send("Esse curso não existe! Por favor tenta outra vez. Se estiveres preso, pede ajuda a um moderador no servidor (@Mods)")
                await msg.channel.send("That degree doesn't exist! Please try again. If you are stuck, ask a mod for help on the server (@Mods)")
        elif state[msg.author.id]["stage"] == 2:
            if msg.content.lower() == "yes":
                await msg.channel.send(embed=parse_embed('finish-pt'))
                await msg.channel.send(embed=parse_embed('finish-en'))
                state[msg.author.id]["stage"] = 3
            elif msg.content.lower() == "no":
                await msg.channel.send(embed=parse_embed('finish-pt'))
                await msg.channel.send(embed=parse_embed('finish-en'))
                member.add_roles(role_veterano)
                state[msg.author.id]["stage"] = 3
            else:
                await msg.channel.send("Resposta inválida, por favor responde apenas com [yes] ou [no]")
        else:
            # O curso já foi adicionado, diz para pedir ajuda a um moderador
            await msg.channel.send(embed=parse_embed('help-pt'))
            await msg.channel.send(embed=parse_embed('help-en'))
            print("Mensagem de ajuda")

# Comandos

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
    # ??? o que é que se faz agora
    await ctx.message.channel.send('Feito')

bot.run(os.environ['DISCORD_TOKEN'])
