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

with open("self_roles.json", "r", encoding="utf-8") as file:
    self_roles = json.load(file)

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
            value=field['value'].replace('$veterano', roles["veterano"].mention).replace(
                '$turista', roles["turista"].mention),
            name=field['name'],
            inline=False
        )

    ret.set_thumbnail(
        url='https://upload.wikimedia.org/wikipedia/pt/e/ed/IST_Logo.png')

    return ret

async def rebuild_self_roles():
    global channels
    await channels["self-roles"].purge()

    #print(self_roles)
    #print(self_roles["groups"])
    #exit(-1)
    for group in self_roles["groups"]:
        #print(group["msg"])
        await channels["self-roles"].send(self_roles["groups"][group]["msg"])
        for role in self_roles["groups"][group]["roles"]:
            msg = await channels["self-roles"].send(self_roles["roles"][role])
            await msg.add_reaction('☑️')
            self_role_msg_ids[role] = msg.id
    #print(self_role_msg_ids)



    
async def rebuild_role_pickers():
    global roles
    global channels
    await channels["escolhe-o-teu-curso"].purge()

    await channels["escolhe-o-teu-curso"].send(embed=parse_embed('welcome-pt'))
    await channels["escolhe-o-teu-curso"].send(embed=parse_embed('welcome-en'))

    for i in range(0, len(degrees)):
        msg = await channels["escolhe-o-teu-curso"].send("`{}`".format(degrees[i]["display"]))
        await msg.add_reaction('☑️')
        degrees[i]["msg_id"] = msg.id



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

    global self_roles

    global roles

    global self_roles
    global self_role_ids
    global self_role_msg_ids

    global channels
    global categories
    global courses_category
    roles, channels, categories, self_role_ids, self_role_msg_ids = {}, {}, {}, {}, {}

    channels["escolhe-o-teu-curso"] = get(guild.text_channels, name="escolhe-o-teu-curso")

    channels["entradas"] = get(guild.text_channels, name="entradas")

    channels["self-roles"] = get(guild.text_channels, name="self-roles")    

    courses_category = get(guild.categories, name="Cadeiras")

    roles["turista"] = get(guild.roles, name="TurISTa")
    roles["aluno"] = get(guild.roles, name="Aluno/a")
    roles["veterano"] = get(guild.roles, name="Veterano/a")
    roles["tagus"] = get(guild.roles, name="Tagus Park")
    roles["alameda"] = get(guild.roles, name="Alameda")
    roles["admin"] = get(guild.roles, name="Admin")
    roles["admin_plus"] = get(guild.roles, name="Admin+")


    for channel in channels:
        if channels[channel] is None:

            print(f"O guild tem de ter um channel '#{channel}'")
            exit(-1)

    for role in roles:
        if roles[role] is None:
            print(f"O guild tem de ter uma role '{role}'")
            exit(-1)

    #Self roles
    for self_role in self_roles["roles"]:
        self_role_ids[self_role] = get(guild.roles, name=self_role)
        #print(self_role_ids[self_role])
        if self_role_ids[self_role] is None:
            print(f"O guild tem de ter uma self_role '{self_role}'")

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
    roles_messages = await channels["escolhe-o-teu-curso"].history().flatten()
    for msg in roles_messages:
        for degree in degrees:
            if degree["display"] in msg.content and msg.author.bot:
                degree["msg_id"] = msg.id
                found_count += 1
                break



    # Se não estiverem todas, apaga todas as mensagens do canal e escreve de novo
    if found_count != len(degrees):
        await rebuild_role_pickers()

    #Verificar se as mensagens do #self-roles já existem
    self_roles_messages = await channels["self-roles"].history().flatten()
    self_roles_found_count = 0
    for self_role in self_roles["roles"]:
        self_role_msg = self_roles["roles"][self_role]
        for msg in self_roles_messages:
            if self_role_msg == msg.content:
                self_roles_found_count +=1
            else:
                print(self_role_msg)
                #print(self_roles_messages)

    #for msg in self_roles_messages:
     #   if msg == self_roles["roles"]:
     #       self_roles_found_count +=1

    print(f"self_roles_found_count: {self_roles_found_count}\n len(self_roles['roles']) = {len(self_roles['roles'])}")
    if self_roles_found_count != len(self_roles["roles"]):
        await rebuild_self_roles()



@bot.event
async def on_member_join(member):
    await channels["entradas"].send(
        'Bem vind@ {}! Vai ao canal {} para escolheres o teu curso e a {} para escolheres outras roles.'.format(
            member.mention, channels["escolhe-o-teu-curso"].mention, channels["self-roles"].mention))

@bot.event
async def on_raw_reaction_add(payload):
    member = guild.get_member(payload.user_id)
    if member.bot:
        return

    #print(channels)       
    allowed_channel_ids = [channels["escolhe-o-teu-curso"].id,channels["self-roles"].id]
    #print(allowed_channel_ids)
    if payload.channel_id not in allowed_channel_ids or payload.emoji.name != '☑️':
        print("channel id filter test failed")
        return
    

    for degree in degrees:
        if degree["msg_id"] == payload.message_id:
            # Verificar se o membro já tem qualquer outra role de curso
            for degree_2 in degrees:
                if degree == degree_2:
                    continue
                if degree_2["role"] in member.roles:
                    msg = await channels["escolhe-o-teu-curso"].fetch_message(payload.message_id)
                    await msg.remove_reaction('☑️', member)
                    return
            print("Role do curso {} adicionada ao membro {}".format(degree["name"], member))
            await member.remove_roles(roles["turista"])
            await member.add_roles(degree["role"], roles["aluno"])
            if degree["tagus"]:
                await member.add_roles(roles["tagus"])
            else:
                await member.add_roles(roles["alameda"])
            return

    #Check for self roles
    for role in self_role_msg_ids:
        #print(self_role_msg_ids[role])
        if payload.message_id == self_role_msg_ids[role]:
            await member.add_roles(self_role_ids[role])

@bot.event
async def on_raw_reaction_remove(payload):
    member = guild.get_member(payload.user_id)
    
    if member.bot:
        return
    #print(channels)       
    allowed_channel_ids = [channels["escolhe-o-teu-curso"].id,channels["self-roles"].id]
    #print(allowed_channel_ids)
    if payload.channel_id not in allowed_channel_ids or payload.emoji.name != '☑️':
        print("channel id filter test failed")
        return


    for degree in degrees:
        if degree["msg_id"] == payload.message_id:
            if degree["role"] in member.roles:
                if degree["tagus"]:
                    await member.remove_roles(roles["tagus"])
                else:
                    await member.remove_roles(roles["alameda"])
                await member.remove_roles(degree["role"], roles["aluno"])
                await member.add_roles(roles["turista"])
            print("Role do curso {} removida do membro {}".format(degree["name"], member))
            return
        #Check for self roles
    for role in self_role_msg_ids:
        #print(self_role_msg_ids[role])
        if payload.message_id == self_role_msg_ids[role]:
            await member.remove_roles(self_role_ids[role])

@bot.event
async def on_voice_state_update(user,vc_before,vc_after):
   global guild
   #remove permissions from previous channel first
   if vc_before.channel != None:
        #Skip non join/leave/switch vc channel events
        if vc_before.channel == vc_after.channel:
            return
        vc_txt_before = vc_before.channel.name.lower()
        vc_txt_before = vc_txt_before.replace(" ", "-") + "-vc"
        vc_txt_before = vc_txt_before.replace("+", "plus")
        channel = get(vc_before.channel.category.text_channels, name=vc_txt_before)
        #Txt Channel might not exist the first few times
        if channel != None:
            if len(vc_before.channel.members) == 0:
                await channel.delete()
            else:
                await channel.set_permissions(user, read_messages=False)

   if vc_after.channel != None:
        vc_txt_after = vc_after.channel.name.lower()
        vc_txt_after = vc_txt_after.replace(" ", "-") + "-vc"

        #VC rooms with non valid chars for txt rooms will still fail and create
        #multiple txt channels for each user join
        #Nevertheless, fix VC rooms with a '+' in their name
        vc_txt_after = vc_txt_after.replace("+", "plus")

        channel = get(vc_after.channel.category.text_channels, name=vc_txt_after)
        if channel == None:
            overwrites = {
                guild.default_role: PermissionOverwrite(read_messages=False),
                user: PermissionOverwrite(read_messages=True)
            }
            channel = await vc_after.channel.category.create_text_channel(
                name=vc_txt_after, overwrites=overwrites)
        else:
            await channel.set_permissions(user, read_messages=True)


def get_no_permission_msg(user_id):
    return '<@{}> is not in the sudoers file. This incident will be reported.'.format(user_id)
    
# Comandos
@bot.command(pass_context=True)
async def reset_admin(ctx):
    if not roles["admin"] in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    for member in guild.members:
        if roles["admin_plus"] in member.roles:
            await member.remove_roles(roles["admin_plus"])

@bot.command(pass_context=True)
async def version(ctx):
    await ctx.message.channel.send("{}".format(version_number))

@bot.command(pass_context=True)
async def sudo(ctx):
    if not roles["admin"] in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    if roles["admin_plus"] not in ctx.author.roles:
        await ctx.author.add_roles(roles["admin_plus"])
    else:
        await ctx.author.remove_roles(roles["admin_plus"])

@bot.command(pass_context=True)
async def refresh(ctx):
    if not roles["admin"] in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return
    await ctx.message.channel.send('A atualizar o bot...')
    await rebuild_role_pickers()
    await ctx.message.channel.send('Feito')

@bot.command(pass_context=True)
async def make_leaderboard(ctx):
    if not roles["admin"] in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return
    
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
    if not roles["admin"] in ctx.author.roles:
        await ctx.message.channel.send(get_no_permission_msg(ctx.author.id))
        return

    for course in courses_by_degree:
        permissions = {
            guild.default_role: PermissionOverwrite(read_messages=False)
        }
        for degree in courses_by_degree[course]['degrees']:
            degree_obj = next(
                (item for item in degrees if item["name"] == degree), None)
            if degree_obj is not None:
                permissions[degree_obj["role"]] = PermissionOverwrite(
                    read_messages=True)

        course_channel = get(courses_category.text_channels,
                             name=course.lower())
        if course_channel is None:
            await courses_category.create_text_channel(course.lower(), overwrites=permissions, topic=courses_by_degree[course]['name'])
        else:
            await course_channel.edit(overwrites=permissions, topic=courses_by_degree[course]['name'])

bot.run(os.environ['DISCORD_TOKEN'])