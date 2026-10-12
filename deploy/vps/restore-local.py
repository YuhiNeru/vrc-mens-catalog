"""Import a stopped VPS collector checkpoint and only its newly downloaded raw pages."""
import gzip
import json
import pathlib
import re
import sys
import tarfile
root=pathlib.Path.cwd().resolve()
with tarfile.open(sys.argv[1],'r:gz') as archive:
    for member in archive:
        if not member.isfile():raise RuntimeError('Unexpected archive entry')
        name=member.name
        if name=='state.json':target=root/'data/full-accessories/state.json';data=archive.extractfile(member).read()
        elif re.fullmatch(r'budget-\d{4}-\d{2}-\d{2}\.json',name):target=root/'data'/name;data=archive.extractfile(member).read()
        elif re.fullmatch(r'raw/\d{1,12}\.html.gz',name):
            target=root/'data/raw'/pathlib.Path(name).name.removesuffix('.gz')
            if target.exists():continue
            data=gzip.decompress(archive.extractfile(member).read())
        else:raise RuntimeError('Unexpected archive path')
        if root not in target.resolve().parents:raise RuntimeError('Archive path escapes workspace')
        target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_suffix(target.suffix+'.restore.tmp');temp.write_bytes(data);temp.replace(target)
print('Local checkpoint, daily budgets and raw pages restored')
