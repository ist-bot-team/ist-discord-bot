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

bot = commands.Bot(command_prefix='$')

def has_perms(member):
    return role_mod in member.roles

"""
@bot.command(pass_context=True)
async def init(ctx):
    global courses

    if not has_perms(ctx.author.id):
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return
    await ctx.message.channel.send('A inicializar o bot...')

    channel = bot.get_channel(CHANNEL_ID)
    await channel.send('Reage com um ✅ na mensagem que corresponde ao teu curso.')

    for i in range(0, len(cursos)):
        msg = await channel.send(cursos[i][0])
        await msg.add_reaction('✅')
        cursos[i][1] = msg.id

    msg = await channel.send('Se este não é o teu primeiro ano no técnico reage com um ✅ a esta mensagem.')
    await msg.add_reaction('✅')
    veterano = msg.id

    msg = await channel.send('Se não estudares no técnico reage com um ✅ a esta mensagem.')
    await msg.add_reaction('✅')
    turista = msg.id

    await ctx.message.channel.send('Feito!')

@bot.command(pass_context=True)
async def clear(ctx):
    if ctx.author.id != OWNER_ID:
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return
    await ctx.message.channel.send('A limpar o canal do bot...')
    channel = bot.get_channel(CHANNEL_ID)
    await channel.purge()

@bot.command(pass_context=True)
async def ping(ctx):
    await ctx.message.channel.send('pong')

@bot.command(pass_context=True)
async def admin(ctx):
    if ctx.author.id != OWNER_ID:
        await ctx.message.channel.send('Não tens permissão para usar este comando')
        return
    
        
    await ctx.message.channel.send(VERSION)
"""

async def rebuild():
    await roles_channel.purge()

    embed = Embed(title="Bem vind@", description="Bem vind@ ao servidor de discord dos caloiros do IST.", color=0x00ff00)
    embed.add_field(value="""
        Reage com um ☑️ na mensagem que corresponder ao teu curso no IST.
        Se não estudares no IST podes permanecer neste servidor como {}.
        Se este não é o teu primeiro ano no IST podes pedir a role {} ao {}.
    """.format(role_turista.mention, role_veterano.mention, "<@227849349734989834>"), name="Escolhe um curso")
    await roles_channel.send(embed=embed)

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
        await member.add_roles(role_admin)
    else:
        await member.remove_roles(role_admin)

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
    role_turista = get(guild.roles, name="Turista")
    role_aluno = get(guild.roles, name="Aluno")
    role_veterano = get(guild.roles, name="Veterano")
    role_tagus = get(guild.roles, name="Tagus Park")
    role_alameda = get(guild.roles, name="Alameda")
    role_mod = get(guild.roles, name="MOD")
    role_admin = get(guild.roles, name="Admin")

    if role_turista is None or role_aluno is None or role_veterano is None or role_tagus is None or role_alameda is None or role_mod is None or role_admin is None:
        print('O guild tem de ter uma role "Turista", uma role "Aluno", uma role "Veterano", uma role "Tagus Park", uma role "Alameda", uma role "MOD" e uma role "Admin".')
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
    if payload.channel_id != roles_channel.id or payload.emoji.name != '☑️':
        return

    member = guild.get_member(payload.user_id)
    
    if member.bot:
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
                    await msg.remove_reaction('☑️', member)
                    return
            print("Role do curso {} adicionada ao membro {}".format(course["name"], member))
            await member.remove_roles(role_turista)
            await member.add_roles(course["role"], role_aluno)
            if course["tagus"]:
                await member.add_roles(role_tagus)
            else:
                await member.add_roles(role_alameda)
            return

@bot.event
async def on_raw_reaction_remove(payload):
    if payload.channel_id != roles_channel.id or payload.emoji.name != '☑️':
        return

    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return

    # Encontrar a mensagem correta
    for course in courses:
        if course["msg_id"] == payload.message_id:
            if course["role"] in member.roles:
                if course["tagus"]:
                    await member.remove_roles(role_tagus)
                else:
                    await member.remove_roles(role_alameda)
                await member.remove_roles(course["role"], role_aluno)
                await member.add_roles(role_turista)
            print("Role do curso {} removida do membro {}".format(course["name"], member))
            return

bot.run(os.environ['DISCORD_TOKEN'])
