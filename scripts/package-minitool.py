"""Package and verify exactly the statically audited files, without a wrapper folder."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
artifact = root / 'dist-minitool'
release = root / 'release'
report = json.loads((release / 'minitool-static-audit.json').read_text(encoding='utf-8'))
assert report['status'] == 'passed'
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
target = release / f'cat-protect-{version}-minitool.zip'
auditor = root / '.codex/minitool-zip-builder/scripts/audit_artifact.py'
subprocess.run([sys.executable, str(auditor), str(artifact)], check=True)
for item in report['files']:
    assert hashlib.sha256((artifact / item['name']).read_bytes()).hexdigest() == item['sha256'], 'Artifact changed after audit'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for item in report['files']:
        archive.write(artifact / item['name'], item['name'])
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert archive.namelist().count('index.html') == 1
    assert sorted(archive.namelist()) == sorted(item['name'] for item in report['files'])
    for item in report['files']:
        assert hashlib.sha256(archive.read(item['name'])).hexdigest() == item['sha256']
assert target.stat().st_size <= 10 * 1024 * 1024
subprocess.run([sys.executable, str(auditor), str(target)], check=True)
summary = {'path': str(target), 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'files': len(report['files']), 'zipCRC': 'passed', 'zipContentsMatchAuditedDirectory': True}
(release / 'minitool-package.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2))
