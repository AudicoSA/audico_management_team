"""Database migration runner for Supabase."""
import os
from pathlib import Path

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from src.utils.config import get_config
from src.utils.logging import get_logger, setup_logging

setup_logging()
logger = get_logger("migrations")


def get_db_connection_string() -> str:
    """Build PostgreSQL connection string from Supabase URL."""
    config = get_config()
    # Extract components from Supabase URL
    # Format: https://[project-ref].supabase.co
    project_ref = config.supabase_url.replace("https://", "").replace(".supabase.co", "")

    # Supabase Postgres connection
    return f"postgresql://postgres:[PASSWORD]@db.{project_ref}.supabase.co:5432/postgres"


def run_migrations() -> None:
    """Run all SQL migration files in order."""
    config = get_config()
    migrations_dir = Path(__file__).parent / "migrations"

    logger.info("migration_start", migrations_dir=str(migrations_dir))

    # Get all .sql files sorted by name
    migration_files = sorted(migrations_dir.glob("*.sql"))

    if not migration_files:
        logger.warning("no_migrations_found")
        return

    # Connect using service role key (has superuser privileges)
    # Note: For Supabase, we use the service role key as password
    conn_string = get_db_connection_string().replace(
        "[PASSWORD]", config.supabase_service_role_key
    )

    try:
        # Connect to database
        conn = psycopg2.connect(conn_string)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        logger.info("database_connected")

        # Run each migration
        for migration_file in migration_files:
            logger.info("running_migration", file=migration_file.name)

            with open(migration_file, "r", encoding="utf-8") as f:
                sql = f.read()

            try:
                cursor.execute(sql)
                logger.info("migration_success", file=migration_file.name)
            except Exception as e:
                logger.error("migration_failed", file=migration_file.name, error=str(e))
                raise

        cursor.close()
        conn.close()

        logger.info("all_migrations_complete")

    except Exception as e:
        logger.error("migration_error", error=str(e))
        raise


if __name__ == "__main__":
    run_migrations()
