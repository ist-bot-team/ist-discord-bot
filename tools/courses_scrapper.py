import requests
import re
import json

# Intervalo [since,until[ de pares (Ano,Semestre) para dar scrapping
# Provavelmente nada robusto mas há que ter fé
since = [1, 2]
until = [2, 1]


def scrape_degree(degree):
    html = requests.get(
        'https://fenix.tecnico.ulisboa.pt/cursos/{}/curriculo'.format(
            degree)).text
    start = html.find('<h4>Ano {}, Semestre {}</h4>'.format(*since))
    end = html.find('<h4>Ano {}, Semestre {}</h4>'.format(*until))
    courses = re.findall(r'>(.*)\s<\/a>', html[start:end])
    return courses


course_acronym_map = {}


def add_all_courses_from_degree(degree_id):
    global course_acronym_map
    courses = requests.get(
        'https://fenix.tecnico.ulisboa.pt/api/fenix/v1/degrees/{}/courses?academicTerm=2020/2021'
        .format(degree_id)).json()
    for course in courses:
        if course['name'] not in course_acronym_map:
            acronym = re.match(".*?([A-Za-z]+)\d*",
                               course['acronym']).groups()[0].lower()
            trailingRomanNumeral = re.search(" (III|II|I|IV|V|VIII|VII|VI|)$",
                                             course['name'])
            if trailingRomanNumeral:
                acronym += '-{}'.format(
                    trailingRomanNumeral.groups()[0].lower())
            course_acronym_map[course['name']] = acronym


all_degrees = requests.get(
    'https://fenix.tecnico.ulisboa.pt/api/fenix/v1/degrees?academicTerm=2020/2021'
).json()
degrees = list(
    filter(
        lambda degree: degree['type'] in
        ['Licenciatura Bolonha', 'Mestrado Integrado'], all_degrees))

degree_courses = {}
for degree in degrees:
    add_all_courses_from_degree(degree['id'])

    courses = scrape_degree(degree['acronym'].lower())

    for course in courses:
        acronym = course_acronym_map[course]
        if acronym not in degree_courses:
            degree_courses[acronym] = {'name': course, 'degrees': []}
        degree_courses[acronym]['degrees'].append(degree['acronym'])

with open('courses_by_degree.json', 'wb') as file:
    file.write(
        json.dumps(degree_courses, ensure_ascii=False,
                   sort_keys=True).encode('utf-8'))
    file.close()