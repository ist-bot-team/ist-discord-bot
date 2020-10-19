import requests
import re
import json

# Intervalo [since,until[ de pares (Ano,Semestre) para dar scrapping
# Provavelmente nada robusto mas há que ter fé
since = [1,1]
until = [1,2]
    
def make_short(name):
    words = name.split()
    words = list(filter(lambda w: w not in ['de','do','da','e','à','com','para'], words))
    num=''
    if words[-1] in ['I','II','III','IV','V','VI','1','2','3','4','5','6']:
        num=words[-1]
        words=words[:-1]

    short = ''
    if len(words)==1:
        short+=words[0][:3]
    elif len(words)==2:
        short+=words[0][0]
        short+=words[1][:3]
    else:
        for word in words:
            short+=word[0]
    
    return short+num

def clean_str(x):
    ret = ''
    for i in range(0, len(x)):
        if x[i] == 'Á':
            ret+= 'A'
        elif x[i] == 'á':
            ret += 'a'
        elif x[i] == 'à':
            ret += 'a'
        elif x[i] == 'ã':
            ret += 'a'
        elif x[i] == 'â':
            ret += 'a'
        elif x[i] == 'é':
            ret += 'e'
        elif x[i] == 'í':
            ret += 'i'
        elif x[i] == 'ú':
            ret += 'u'    
        else:
            ret += x[i]
    return ret

def scrape_degree(degree):
    html = requests.get('https://fenix.tecnico.ulisboa.pt/cursos/{}/curriculo'.format(degree)).text
    start = html.find('<h4>Ano {}, Semestre {}</h4>'.format(*since))
    end = html.find('<h4>Ano {}, Semestre {}</h4>'.format(*until))
    courses = re.findall(r'>(.*)\s<\/a>',html[start:end])
    return courses

all_degrees = requests.get('https://fenix.tecnico.ulisboa.pt/api/fenix/v1/degrees?academicTerm=2020/2021').json()
degrees = list(filter(lambda degree: degree['type'] in ['Licenciatura Bolonha','Mestrado Integrado'] ,all_degrees))

degree_courses = {}
for degree in degrees:
    courses = scrape_degree(degree['acronym'].lower())
    
    cs = []
    for course in courses:
        cs.append(clean_str(make_short(course)))
    degree_courses[degree['acronym']]=set(cs)

courses = set()
for degree in degree_courses:
    courses |= degree_courses[degree]

out = {}
for course in courses:
    cs=[]
    for degree in degree_courses:
        if course in degree_courses[degree]:
            cs.append(degree)
    out[course] = cs

print(len(out))
with open('../courses_by_degree.json','wb') as file:
    file.write(json.dumps(out,ensure_ascii=False).encode('utf-8'))
    file.close()