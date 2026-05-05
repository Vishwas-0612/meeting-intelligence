import os
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv = None
try:
	dotenv_module = __import__("dotenv")
	load_dotenv = getattr(dotenv_module, "load_dotenv", None)
except Exception:
	load_dotenv = None


def _load_env_file(env_path: Path) -> None:
	if not env_path.exists():
		return

	if load_dotenv:
		load_dotenv(env_path)
		return

	for line in env_path.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue

		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		os.environ.setdefault(key, value)

env_path = Path(__file__).with_name(".env")
_load_env_file(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
	db_user = os.getenv("DB_USER", "postgres")
	db_password = os.getenv("DB_PASSWORD")
	db_host = os.getenv("DB_HOST", "localhost")
	db_port = os.getenv("DB_PORT", "5432")
	db_name = os.getenv("DB_NAME", "meetingdb")

	if not db_password:
		raise RuntimeError(
			"Database password not configured. Set DB_PASSWORD or DATABASE_URL in your environment."
		)

	DATABASE_URL = (
		f"postgresql://{db_user}:{quote_plus(db_password)}@{db_host}:{db_port}/{db_name}"
	)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()