"""Publica o jogo no GitHub Pages (https://pedroruedas.github.io/teen-titans-game/).

Copia os arquivos do site para o ramo gh-pages (numa pasta temporária, sem mexer na sua pasta de
trabalho), faz um commit e envia para o GitHub. Uso: python publicar.py
"""
import os
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.abspath(__file__))
ARQUIVOS = ['index.html', 'manifest.webmanifest', 'sw.js']
PASTAS = ['icons', 'js', 'audio']
RAMO = 'gh-pages'
# Sem user.name/email configurados nesta máquina: usa a identidade do autor do projeto.
IDENT = ['-c', 'user.name=Pedro Henrique Ruedas', '-c', 'user.email=161633032+PedroRuedas@users.noreply.github.com']


def git(*args, cwd=RAIZ, check=True):
    r = subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode != 0:
        sys.exit('git ' + ' '.join(args) + ' falhou:\n' + r.stdout + r.stderr)
    return r.stdout.strip()


def main():
    versao = git('rev-parse', '--short', 'HEAD')
    ramo_atual = git('rev-parse', '--abbrev-ref', 'HEAD')
    git('fetch', 'origin', RAMO, check=False)
    tem_remoto = bool(git('ls-remote', '--heads', 'origin', RAMO))
    pasta = tempfile.mkdtemp(prefix='site-')
    try:
        if tem_remoto:
            git('worktree', 'add', '-f', '-B', RAMO, pasta, 'origin/' + RAMO)
        else:  # primeira publicação: ramo novo, sem histórico
            git('worktree', 'add', '--detach', pasta)
            git('checkout', '--orphan', RAMO, cwd=pasta)
        # limpa tudo (menos o .git) e copia a versão atual
        for nome in os.listdir(pasta):
            if nome == '.git':
                continue
            p = os.path.join(pasta, nome)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
        for a in ARQUIVOS:
            shutil.copy2(os.path.join(RAIZ, a), pasta)
        for d in PASTAS:
            shutil.copytree(os.path.join(RAIZ, d), os.path.join(pasta, d), ignore=shutil.ignore_patterns('*.py', '__pycache__'))
        open(os.path.join(pasta, '.nojekyll'), 'w').close()  # serve os arquivos como estão
        git('add', '-A', cwd=pasta)
        if not git('status', '--porcelain', cwd=pasta):
            print('Nada mudou desde a última publicação.')
            return
        git(*IDENT, 'commit', '-q', '-m', 'Publicação de ' + versao + ' (' + ramo_atual + ')', cwd=pasta)
        git('push', '-q', 'origin', RAMO, cwd=pasta)
        print('Publicado ' + versao + ' em https://pedroruedas.github.io/teen-titans-game/ (atualiza em 1-2 minutos).')
    finally:
        git('worktree', 'remove', '--force', pasta, check=False)
        shutil.rmtree(pasta, ignore_errors=True)


if __name__ == '__main__':
    main()
