# Run a command with deploy/.prod.env loaded safely (values may contain & ? = etc.)
import os, subprocess, sys, pathlib
env = dict(os.environ)
for l in pathlib.Path(r"C:/Users/YAS/thyrotrack-ai/deploy/.prod.env").read_text(encoding="utf-8").splitlines():
    if "=" in l:
        k, v = l.split("=", 1); env[k] = v
env["STORAGE_DRIVER"] = "db"
env["PYTHONIOENCODING"] = "utf-8"
sys.exit(subprocess.call(sys.argv[1], shell=True, env=env, cwd=r"C:/Users/YAS/thyrotrack-ai/web"))
