from discord import Embed, PermissionOverwrite, Intents
from discord.ext import commands
from discord.utils import get
import os
import json

# Carregar versão do bot
with open('version', 'r') as file:
    version_number = file.read().replace('\n', '')
    print("Version {}".format(version_number))

# Informação dos cursos
# "display": conteúdo da mensagem utilizada no curso
# "name": nome da role do curso (tem de estar presente no "display")
# "tagus": é um curso do Tagus Park?
# "msg_id": indice da mensagem que foi enviada
with open('degrees.json', 'r', encoding='utf-8') as file:
    degrees = json.load(file)

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

intents = Intents.default()
intents.typing = False
intents.presences = True
intents.members = True
bot = commands.Bot(command_prefix='$', intents=intents)

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

async def rebuild_role_pickers():
    await roles_channel.purge()

    await roles_channel.send(embed=parse_embed('welcome-pt'))
    await roles_channel.send(embed=parse_embed('welcome-en'))

    for i in range(0, len(degrees)):
        msg = await roles_channel.send("`{}`".format(degrees[i]["display"]))
        await msg.add_reaction('☑️')
        degrees[i]["msg_id"] = msg.id

    msg = await roles_channel.send("`Não é o meu primeiro ano no IST`")
    await msg.add_reaction('☑️')
    global veterano_msg_id
    veterano_msg_id = msg.id

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
    roles_channel = get(guild.text_channels, name="escolhe-o-teu-curso")
    welcome_channel = get(guild.text_channels, name="entradas")

    global courses_category
    courses_category = get(guild.categories, name="Cadeiras")

    global role_turista
    global role_aluno
    global role_veterano
    global role_tagus
    global role_alameda
    global role_admin
    global role_admin_plus
    role_turista = get(guild.roles, name="TurISTa")
    role_aluno = get(guild.roles, name="Aluno/a")
    role_veterano = get(guild.roles, name="Veterano/a")
    role_tagus = get(guild.roles, name="Tagus Park")
    role_alameda = get(guild.roles, name="Alameda")
    role_admin = get(guild.roles, name="Admin")
    role_admin_plus = get(guild.roles, name="Admin+")

    if role_turista is None or role_aluno is None or role_veterano is None or role_tagus is None or role_alameda is None or role_admin is None or role_admin_plus is None:
        print('O guild tem de ter uma role "TurISTa", uma role "Aluno/a", uma role "Veterano", uma role "Tagus Park", uma role "Alameda", uma role "Admin" e uma role "Admin+" (sensível a maísculas e minúsculas)')
        exit(-1)

    if courses_category is None:    
        print('O guild tem de ter uma categoria "Cadeiras".')
        exit(-1)

    # Associar cada curso a uma role
    for i in range(0, len(degrees)):
        degrees[i]["role"] = None
        for role in guild.roles:
            if role.name == degrees[i]["name"]:
                degrees[i]["role"] = role
                break
        if degrees[i]["role"] is None:
            print("A role com o nome {} nao existe".format(degrees[i]["name"]))
            exit(-1)

    # Verificar se as mensagens de entrada já estão no canal certo
    found_count = 0
    roles_messages = await roles_channel.history().flatten()
    for msg in roles_messages:
        for degree in degrees:
            if degree["display"] in msg.content and msg.author.bot:
                degree["msg_id"] = msg.id
                found_count += 1
                break
        if "Não é o meu primeiro ano no IST" in msg.content and msg.author.bot:
            global veterano_msg_id
            veterano_msg_id = msg.id
            found_count += 1

    # Senão estiverem todas, apaga todas as mensagens do canal e escreve de novo
    if found_count != len(degrees) + 1:
        await rebuild_role_pickers()

@bot.event
async def on_member_join(member):
    await welcome_channel.send('Bem vind@ {}! Vai ao canal {} para escolheres o teu curso.'.format(member.mention, roles_channel.mention))

@bot.event
async def on_raw_reaction_add(payload):
    if payload.channel_id != roles_channel.id or payload.emoji.name != '☑️':
        return
    
    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return

    # Encontrar a mensagem correta
    if veterano_msg_id == payload.message_id:
        await member.add_roles(role_veterano)
        return

    for degree in degrees:
        if degree["msg_id"] == payload.message_id:
            # Verificar se o membro já tem qualquer outra role de curso
            for degree_2 in degrees:
                if degree == degree_2:
                    continue
                if degree_2["role"] in member.roles:
                    msg = await roles_channel.fetch_message(payload.message_id)
                    await msg.remove_reaction('☑️', member)
                    return
            print("Role do curso {} adicionada ao membro {}".format(degree["name"], member))
            await member.remove_roles(role_turista)
            await member.add_roles(degree["role"], role_aluno)
            if degree["tagus"]:
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
    if veterano_msg_id == payload.message_id:
        await member.remove_roles(role_veterano)
        return

    for degree in degrees:
        if degree["msg_id"] == payload.message_id:
            if degree["role"] in member.roles:
                if degree["tagus"]:
                    await member.remove_roles(role_tagus)
                else:
                    await member.remove_roles(role_alameda)
                await member.remove_roles(degree["role"], role_aluno)
                await member.add_roles(role_turista)
            print("Role do curso {} removida do membro {}".format(degree["name"], member))
            return

# Comandos

def get_no_permission_msg(user_id):
    return '<@{}> is not in the sudoers file. This incident will be reported.'.format(user_id)

@bot.command(pass_context=True)
async def reset_admin(ctx):
    if not role_admin in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    for member in guild.members:
        if role_admin_plus in member.roles:
            await member.remove_roles(role_admin_plus)

@bot.command(pass_context=True)
async def version(ctx):
    await ctx.message.channel.send("{}".format(version_number))

@bot.command(pass_context=True)
async def sudo(ctx):
    if not role_admin in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    if role_admin_plus not in ctx.author.roles:
        await ctx.author.add_roles(role_admin_plus)
    else:
        await ctx.author.remove_roles(role_admin_plus)

@bot.command(pass_context=True)
async def refresh(ctx):
    if not role_admin in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return
    await ctx.message.channel.send('A atualizar o bot...')
    await rebuild_role_pickers()
    await ctx.message.channel.send('Feito')

@bot.command(pass_context=True)
async def make_leaderboard(ctx):
    # Este comando cria uma leaderboard com os utilizadores que mais falaram no servidor.
    visible_user_count = 50
    leaderboard = {}

    for channel in guild.text_channels:
        await ctx.message.channel.send('A ler canal {}'.format(channel.name))
        async for msg in channel.history(limit=None):
            #Filtrar mensagens com caracteres ZWSP
            if not "\u200b" in msg.content:
                if msg.author.id in leaderboard:
                    leaderboard[msg.author.id] += len(msg.content)
                else:
                    leaderboard[msg.author.id] = len(msg.content) 

    leaderboard_msg = "```"
    for user_id in sorted(leaderboard, key=leaderboard.get, reverse=True)[:visible_user_count]:
        leaderboard_msg += '{} - {}\n'.format(guild.get_member(user_id), leaderboard[user_id])
        if len(leaderboard_msg) > 500:
            leaderboard_msg += "```"
            await ctx.message.channel.send('{}'.format(leaderboard_msg))
            leaderboard_msg = "```"
    leaderboard_msg += "```"
    if len(leaderboard_msg) > 6:
        await ctx.message.channel.send('{}'.format(leaderboard_msg))

@bot.command(pass_context=True)
async def rebuild_course_channels(ctx):
    if not role_admin in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    for course in courses_by_degree:
        permissions = {
            guild.default_role: PermissionOverwrite(read_messages=False)
        }
        for degree in courses_by_degree[course]:
            degree_obj = next(
                (item for item in degrees if item["name"] == degree), None)
            if degree_obj is not None:
                permissions[degree_obj["role"]] = PermissionOverwrite(
                    read_messages=True)

        course_channel = get(courses_category.text_channels,
                             name=course.lower())
        if course_channel is None:
            await courses_category.create_text_channel(course.lower(), overwrites=permissions)
        else:
            await course_channel.edit(overwrites=permissions)

bot.run(os.environ['DISCORD_TOKEN'])
