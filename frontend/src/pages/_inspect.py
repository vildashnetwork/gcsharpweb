
import pathlib
content = open('C:/Users/VILDASH NETWORK/Desktop/ALL DATA/GC SHARP/gcsharpweb/frontend/src/pages/StudyGroups.jsx', encoding='utf-8').read()
lines = content.splitlines()
print('total lines:', len(lines))
print('' + '
'.join(lines[:5]))
print('...')
print('' + '
'.join(lines[-3:]))
