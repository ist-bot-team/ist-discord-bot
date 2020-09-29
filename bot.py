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
    version = file.read().replace('\n', '')

# Informação dos cursos
# "display": conteúdo da mensagem utilizada no curso
# "name": nome da role do curso (tem de estar presente no "display")
# "tagus": é um curso do Tagus Park?
# "msg_id": indice da mensagem que foi enviada
with open('courses.json', 'r', encoding='utf-8') as file:
    courses = json.load(file)

bot = commands.Bot(command_prefix='$')

def has_perms(user_id):
    # To do: verificar se tem role de moderador
    return True

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

    #await roles_channel.send("""```
#Bem vind@! Reage com um ✅ na mensagem que corresponde ao teu curso.
#Se este não é o teu primeiro ano a estudar no técnico, fala com o <@227849349734989834> para ganhar a role de {}.
    #```""".format(role_veterano.mention))

    embed = Embed(title="Title", description="Desc", color=0x00ff00)
    embed.add_field(name="Fiel1", value="hi", inline=False)
    embed.add_field(name="Field2", value="hi2", inline=False)
    await roles_channel.send(embed=embed)

    for i in range(0, len(courses)):
        msg = await roles_channel.send("`{}`".format(courses[i]["display"]))
        await msg.add_reaction('☑️')
        courses[i]["msg_id"] = msg.id

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
    role_turista = get(guild.roles, name="Turista")
    role_aluno = get(guild.roles, name="Aluno")
    role_veterano = get(guild.roles, name="Veterano")

    if role_turista is None or role_aluno is None or role_veterano is None:
        print('O guild tem de ter uma role "Turista", uma role "Aluno" e uma role "Veterano')
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
    member.add_roles(role_turista)

@bot.command(pass_context=True)
async def version(ctx):
    await ctx.message.channel.send(version)

"""
@bot.event
async def on_raw_reaction_add(payload):
    if payload.channel_id != CHANNEL_ID or payload.emoji.name != '✅':
        return

    guild = bot.get_guild(payload.guild_id)
    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return

    # Encontrar a mensagem correta
    if payload.message_id == veterano:
        role = get(guild.roles, name="Veterano")
        print("Role de veterano adicionada ao membro {} | {}".format(member, role))
        await member.add_roles(role)
        return
    elif payload.message_id == turista:
        role = get(guild.roles, name="Turista")
        print("Role de turista adicionada ao membro {} | {}".format(member, role))
        await member.add_roles(role)
        return

    for curso in cursos:
        if curso[1] == payload.message_id:
            # Verificar se o membro já tem qualquer outra role de curso
            for curso2 in cursos:
                if curso == curso2:
                    continue
                if get(member.roles, name=curso2[0]) != None:
                    return
            role = get(guild.roles, name=curso[0])
            print("Role do curso {} adicionada ao membro {} | {}".format(curso[0], member, role))
            await member.add_roles(role)
            return

@bot.event
async def on_raw_reaction_remove(payload):
    if payload.channel_id != CHANNEL_ID or payload.emoji.name != '✅':
        return

    guild = bot.get_guild(payload.guild_id)
    member = get(guild.members, id=payload.user_id)

    if member.bot:
        return

    # Encontrar a mensagem correta
    if payload.message_id == veterano:
        role = get(guild.roles, name="Veterano")
        print("Role de veterano removida ao membro {} | {}".format(member, role))
        await member.remove_roles(role)
        return
    elif payload.message_id == turista:
        role = get(guild.roles, name="Turista")
        print("Role de turista removida ao membro {} | {}".format(member, role))
        await member.remove_roles(role)
        return

    for curso in cursos:
        if curso[1] == payload.message_id:
            role = get(guild.roles, name=curso[0])
            await member.remove_roles(role)
            print("Role do curso {} removida do membro {}".format(curso[0], member))
            return
"""
bot.run(os.environ['DISCORD_TOKEN'])
