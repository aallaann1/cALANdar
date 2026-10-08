import logging
from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)

def sync_database_schema(engine, Base):
    """
    Non-destructive schema synchronization.
    1. Creates any missing tables without touching existing ones.
    2. Inspects existing tables and dynamically adds any missing columns
       defined in SQLAlchemy models using 'ALTER TABLE ADD COLUMN IF NOT EXISTS'.
    3. Guarantees that all existing database rows and data remain 100% untouched.
    """
    try:
        # Step 1: Create any tables that don't exist yet
        Base.metadata.create_all(bind=engine)

        # Step 2: Compare existing DB columns with model definitions
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        for table_name, table in Base.metadata.tables.items():
            if table_name in existing_tables:
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                for column in table.columns:
                    if column.name not in existing_columns:
                        col_type = column.type.compile(engine.dialect)
                        # Build safe ALTER TABLE statement
                        alter_query = f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{column.name}" {col_type};'
                        logger.info(f"Adding missing column: {table_name}.{column.name} ({col_type})")
                        with engine.begin() as conn:
                            conn.execute(text(alter_query))

        logger.info("Database schema synchronized successfully without modifying existing data.")
    except Exception as e:
        logger.error(f"Error during schema synchronization: {e}", exc_info=True)
