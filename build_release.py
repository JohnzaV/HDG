"""Build the standalone HTML, local preview and GitHub Pages source archive."""
import base64
from pathlib import Path
import re
from shutil import copy2
import zipfile

ROOT = Path(__file__).resolve().parent
VERSION = "1.3"
source = (ROOT / "index.html").read_text()
css = (ROOT / "styles.css").read_text()
engine = (ROOT / "engine.js").read_text()
app = (ROOT / "app.js").read_text()
assert "</script" not in engine.lower() and "</script" not in app.lower()
standalone = source.replace(
    f'<link rel="stylesheet" href="./styles.css?v={VERSION}">',
    "<style>\n" + css + "\n</style>",
)
standalone = re.sub(r'  <script defer src="\./(?:engine|app)\.js\?v=1\.3"></script>\n', "", standalone)
standalone = standalone.replace(
    "./favicon.svg",
    "data:image/svg+xml;base64," + base64.b64encode((ROOT / "favicon.svg").read_bytes()).decode(),
).replace('class="brand" href="./"', 'class="brand" href=""')
standalone = standalone.replace(
    "</body>",
    "<script>\n" + engine + "\n</script>\n<script>\n" + app + "\n</script>\n</body>",
)
assert '<script defer src=' not in standalone
assert 'href="./styles.css' not in standalone
(ROOT / "Heading_Lab.html").write_text(standalone)
(ROOT / "dist").mkdir(exist_ok=True)
for name in ["index.html", "Heading_Lab.html", "styles.css", "engine.js", "app.js", "favicon.svg"]:
    copy2(ROOT / name, ROOT / "dist" / name)

files = ["index.html", "Heading_Lab.html", "styles.css", "engine.js", "app.js", "favicon.svg",
         "README.md", ".nojekyll", ".gitignore", "build_release.py", "tests/engine.test.cjs"]
archive_path = ROOT.parent / "Heading_Lab_GitHub_Pages_v1_3.zip"
with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(ROOT / name, f"heading-lab-v{VERSION}/{name}")
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
print(archive_path)
