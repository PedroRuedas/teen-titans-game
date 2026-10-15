# Monta o .zip para enviar ao itch.io: python itch-io/montar_zip.py  ->  itch-io/jovens-titas-itch.zip
# Leva os mesmos arquivos do site (index.html na raiz do zip, como o itch.io exige), menos a fala da
# Ravena recortada da dublagem: o áudio é da série, então no itch.io a fala usa o som gerado pelo jogo.
import os, re, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'itch-io', 'jovens-titas-itch.zip')
ARQUIVOS = ['index.html', 'manifest.webmanifest', 'sw.js']
PASTAS = ['js', 'icons', 'audio']
FORA = {'audio/vozes/ravena-azarath.mp3', 'icons/make_icons.py'}


def ajustar(nome, texto):
    if nome == 'audio/arquivos.js':
        texto = re.sub(r"\n\s*'raven:[^\n]*ravena-azarath\.mp3',", '', texto)
    if nome == 'sw.js':
        texto = texto.replace("'audio/vozes/ravena-azarath.mp3', ", '')
    if 'ravena-azarath' in texto:
        raise SystemExit('ainda há referência à fala da dublagem em ' + nome)
    return texto


def main():
    nomes = list(ARQUIVOS)
    for p in PASTAS:
        for base, _, fs in os.walk(os.path.join(RAIZ, p)):
            for f in fs:
                nomes.append(os.path.relpath(os.path.join(base, f), RAIZ).replace(os.sep, '/'))
    nomes = sorted(n for n in nomes if n not in FORA)
    with zipfile.ZipFile(SAIDA, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in nomes:
            caminho = os.path.join(RAIZ, n)
            if n.endswith(('.js', '.html', '.webmanifest')):
                with open(caminho, encoding='utf-8') as f:
                    z.writestr(n, ajustar(n, f.read()))
            else:
                z.write(caminho, n)
    print(SAIDA, len(nomes), 'arquivos,', os.path.getsize(SAIDA) // 1024, 'KB')


if __name__ == '__main__':
    main()
